from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import sqlite3
import google.generativeai as genai
import json
import io
from typing import List, Dict, Any, Optional
import uvicorn
import logging
import os
import re
from dotenv import load_dotenv  # Add this import

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

google_vars_to_clear = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GOOGLE_CLOUD_PROJECT', 
    'GCLOUD_PROJECT',
    'GOOGLE_CLOUD_REGION',
    'GOOGLE_CLOUD_ZONE',
    'GOOGLE_API_USE_MTLS_ENDPOINT',
    'GOOGLE_API_USE_CLIENT_CERTIFICATE'
]

for var in google_vars_to_clear:
    if var in os.environ:
        logger.info(f"Clearing potentially interfering environment variable: {var}")
        del os.environ[var]

# Load environment variables from .env file
load_dotenv()  # Add this line

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Data Analytics API", version="1.0.0")

# Add CORS middleware to allow requests from React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://querybot-three.vercel.app"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class QueryRequest(BaseModel):
    query: str
    table_name: str = "Data"
    api_key: Optional[str] = None

class QueryResponse(BaseModel):
    success: bool
    data: List[Dict[str, Any]]
    columns: List[str]
    question: str
    sql_query: Optional[str] = None
    message: Optional[str] = None
    ai_summary: Optional[str] = None  # Add AI summary field

class GeminiSettings(BaseModel):
    model: str = "gemini-2.5-flash"
    api_key: Optional[str] = None
    temperature: float = 0.0
    top_p: float = 0.9

class ApiKeyRequest(BaseModel):
    api_key: str

class SampleQuestionsResponse(BaseModel):
    questions: List[str]
    data_type: str
    columns_analyzed: List[str]

# Global variables to store data
current_dataframe: Optional[pd.DataFrame] = None
current_connection: Optional[sqlite3.Connection] = None

# Default API key - now properly loaded from .env file
DEFAULT_API_KEY = os.getenv("GEMINI_API_KEY")

# Add debug logging to verify the API key is loaded
if DEFAULT_API_KEY:
    logger.info(f"API key loaded successfully: {DEFAULT_API_KEY[:10]}...")
else:
    logger.warning("No GEMINI_API_KEY found in environment variables")

# Gemini Client Class
class GeminiClient:
    def __init__(self, model="gemini-2.5-flash", api_key=None):
        self.model = model
        self.api_key = api_key or DEFAULT_API_KEY
        self.temperature = 0.0
        self.top_p = 0.9
        self._configure_client()
    
    def _configure_client(self):
        """Configure the Gemini client with API key"""
        try:
            if self.api_key and self.api_key != "YOUR_DEFAULT_API_KEY_HERE":
                genai.configure(api_key=None)
                genai.configure(api_key=self.api_key)
                self.client = genai.GenerativeModel(self.model)
                logger.info(f"Gemini client configured with model: {self.model}")
            else:
                logger.warning("No valid API key provided")
                self.client = None
        except Exception as e:
            logger.error(f"Error configuring Gemini client: {e}")
            self.client = None
    
    def test_connection(self):
        """Test if Gemini API is accessible"""
        try:
            if not self.client:
                return False
            
            response = self.client.generate_content(
                "Say 'test' if you can read this.",
                generation_config=genai.types.GenerationConfig(
                    temperature=0,
                    max_output_tokens=10
                )
            )
            return response.text.strip().lower() == "test"
        except Exception as e:
            logger.warning(f"Gemini connection test failed: {e}")
            return False
    
    def get_available_models(self):
        """Get list of available Gemini models"""
        try:
            if not self.api_key or self.api_key == "YOUR_DEFAULT_API_KEY_HERE":
                return []
            
            genai.configure(api_key=self.api_key)
            models = []
            for model in genai.list_models():
                if 'generateContent' in model.supported_generation_methods:
                    models.append(model.name.replace('models/', ''))
            return models
        except Exception as e:
            logger.warning(f"Failed to get available models: {e}")
            return ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-pro"]
    
    def update_api_key(self, api_key: str):
        """Update the API key and reconfigure client"""
        self.api_key = api_key
        self._configure_client()
    
    def generate_response(self, prompt, system_prompt=None):
        """Generate response using Gemini"""
        try:
            if not self.client:
                logger.error("Gemini client not configured properly")
                return None
            
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            logger.info(f"Sending request to Gemini API with model: {self.model}")
            
            generation_config = genai.types.GenerationConfig(
                temperature=self.temperature,
                top_p=self.top_p,
                max_output_tokens=1000,
            )
            
            response = self.client.generate_content(
                full_prompt,
                generation_config=generation_config
            )
            
            if response.text:
                result = response.text.strip()
                logger.info(f"Gemini response received: {result[:100]}...")
                return result
            else:
                logger.error("Gemini returned empty response")
                return None
                
        except Exception as e:
            logger.error(f"Gemini API error: {str(e)}")
            return None

# Initialize Gemini client
gemini_client = GeminiClient(model="gemini-2.5-flash")

def generate_ai_summary(user_question, query_results, sql_query, api_key=None):
    """Generate AI-powered analytical summary of query results"""
    
    client_to_use = gemini_client
    if api_key:
        client_to_use = GeminiClient(api_key=api_key)
    
    if not client_to_use.test_connection():
        logger.info("Gemini not available for summary generation")
        return None
    
    try:
        # Prepare data sample for analysis (limit to avoid token limits)
        data_sample = query_results[:10] if len(query_results) > 10 else query_results
        
        # Extract key insights from the data
        total_records = len(query_results)
        columns = list(query_results[0].keys()) if query_results else []
        
        # Identify numeric columns and calculate basic stats
        numeric_insights = []
        categorical_insights = []

        insights = {
        'total_records': total_records,
        'key_metrics': {},
        'patterns': []
        }

        for col in columns:
           values = [row.get(col) for row in query_results if row.get(col) is not None]
           try:
               numeric_values = [float(v) for v in values if str(v).replace('.', '').replace('-', '').replace(',', '').isdigit()]
               if len(numeric_values) > 0:
                    insights['key_metrics'][col] = {
                'min': min(numeric_values),
                'max': max(numeric_values),
                'avg': round(sum(numeric_values) / len(numeric_values), 2)
               }
           except:
                continue

        if query_results:
            for col in columns:
                values = [row.get(col) for row in query_results if row.get(col) is not None]
                
                # Check if column is numeric
                try:
                    numeric_values = [float(v) for v in values if str(v).replace('.', '').replace('-', '').isdigit()]
                    if len(numeric_values) > 0:
                        numeric_insights.append({
                            'column': col,
                            'min': min(numeric_values),
                            'max': max(numeric_values),
                            'avg': sum(numeric_values) / len(numeric_values),
                            'count': len(numeric_values)
                        })
                except:
                    # Handle categorical data
                    if len(values) > 0:
                        unique_values = list(set([str(v) for v in values]))
                        if len(unique_values) <= 10:  # Only for manageable categories
                            categorical_insights.append({
                                'column': col,
                                'unique_count': len(unique_values),
                                'top_values': unique_values[:5]
                            })
        
        system_prompt = """You are an expert data analyst. Generate a concise, insightful summary of query results.
ANALYSIS APPROACH:
- Focus on actionable business insights, not just data description
- Identify trends, patterns, and outliers that matter
- Provide context for what the numbers mean
- Suggest implications or next steps when relevant

RESPONSE FORMAT:
- Write 2-4 clear, professional sentences
- Start with the most important finding
- Use specific numbers and percentages
- End with business relevance or implication

TONE: Professional, confident, insight-driven (not just descriptive)"""
        
        query_intent = "general"
        if any(word in user_question.lower() for word in ['top', 'highest', 'best', 'maximum']):
           query_intent = "ranking"
        elif any(word in user_question.lower() for word in ['total', 'sum', 'count', 'how many']):
           query_intent = "aggregation"
        elif any(word in user_question.lower() for word in ['average', 'mean']):
           query_intent = "central_tendency"
        elif any(word in user_question.lower() for word in ['compare', 'vs', 'difference']):
           query_intent = "comparison"

        prompt = f"""BUSINESS QUERY ANALYSIS:

Query Intent: {query_intent}
User Question: "{user_question}"
Results Found: {total_records} records

KEY METRICS: {insights['key_metrics']}
REPRESENTATIVE DATA: {data_sample}

ANALYSIS REQUIREMENTS:
- What does this data reveal about the business situation?
- What are the key takeaways for decision-making?
- Are there any notable patterns or outliers?

Generate executive summary:"""

        summary = client_to_use.generate_response(prompt, system_prompt)
        
        if summary:
    # Clean and optimize summary
          summary = summary.strip()
    # Remove common prefixes
          prefixes_to_remove = ['summary:', 'analysis:', 'insight:', 'key finding:', 'result:']
          for prefix in prefixes_to_remove:
              if summary.lower().startswith(prefix):
                  summary = summary[len(prefix):].strip()
    
          logger.info("Generated enhanced AI summary successfully")
          return summary
        
    except Exception as e:  # <-- ADD THIS
        logger.error(f"Error generating AI summary: {str(e)}")
        return None


def detect_data_type_and_context(df):
    """Analyze the dataframe to detect what type of data it is"""
    columns = [col.lower() for col in df.columns]
    column_names = df.columns.tolist()
    
    data_contexts = {
        'supply_chain': ['supplier', 'order', 'quantity', 'shipment', 'delivery', 'inventory', 'procurement', 'vendor'],
        'employee': ['employee', 'salary', 'department', 'position', 'hire', 'manager', 'staff', 'hr'],
        'sales': ['sales', 'revenue', 'customer', 'product', 'price', 'purchase', 'transaction', 'order'],
        'finance': ['amount', 'balance', 'account', 'payment', 'expense', 'income', 'budget', 'cost'],
        'inventory': ['stock', 'warehouse', 'item', 'sku', 'inventory', 'quantity', 'location'],
        'customer': ['customer', 'client', 'contact', 'phone', 'email', 'address', 'demographics'],
        'project': ['project', 'task', 'milestone', 'deadline', 'status', 'team', 'progress'],
        'marketing': ['campaign', 'lead', 'conversion', 'roi', 'engagement', 'impression', 'click']
    }
    
    context_scores = {}
    for context, keywords in data_contexts.items():
        score = sum(1 for keyword in keywords if any(keyword in col for col in columns))
        if score > 0:
            context_scores[context] = score
    
    if context_scores:
        detected_context = max(context_scores, key=context_scores.get)
        confidence = context_scores[detected_context] / len(columns)
    else:
        detected_context = 'general'
        confidence = 0
    
    return detected_context, confidence, column_names

def generate_contextual_sample_questions(df, data_context, api_key=None):
    """Generate sample questions based on the actual data structure and context"""
    
    columns = df.columns.tolist()
    sample_data = df.head(3).to_dict('records')
    
    client_to_use = gemini_client
    if api_key:
        client_to_use = GeminiClient(api_key=api_key)
    
    if client_to_use.test_connection():
        logger.info("Using Gemini to generate contextual sample questions")
        
        clean_sample = []
        for row in sample_data[:2]:
            clean_row = {}
            for k, v in row.items():
                if pd.isna(v):
                    clean_row[k] = "N/A"
                else:
                    clean_row[k] = str(v)[:50]
            clean_sample.append(clean_row)

        system_prompt = """You are an expert data analyst. Generate 4 relevant sample questions that should relate to the dataset provided and that users would typically ask about their dataset.
QUESTION REQUIREMENTS:
- Generate EXACTLY 4 questions, one per line
- Each question must be answerable with the available data
- Use natural business language (not technical jargon)
- Include questions of varying complexity (simple to analytical)
- Focus on real business insights, not just data counts

QUESTION TYPES TO INCLUDE:
1. One simple filtering/viewing question
2. One aggregation question (totals, averages, counts)
3. One ranking/comparison question
4. One analytical/insight question

OUTPUT FORMAT:
- No numbering, bullets, or quotation marks
- Each question on a separate line
- Use exact column names from the dataset"""
        
        prompt = f"""Dataset Analysis:
Data Context: {data_context}
Columns: {', '.join(columns)}
Sample Data (first 2 rows): {clean_sample}
Total Rows: {len(df)}

Based on this {data_context} dataset, generate 4 sample questions that would be relevant for analysis.
Focus on insights that would be valuable for business decision-making.

Generate questions now:"""

        try:
            response = client_to_use.generate_response(prompt, system_prompt)
            
            if response:
                questions = []
                lines = response.strip().split('\n')
                for line in lines:
                    clean_line = line.strip()
                    clean_line = re.sub(r'^\d+[\.\)]\s*', '', clean_line)
                    clean_line = re.sub(r'^[-*]\s*', '', clean_line)
                    clean_line = clean_line.strip('"\'')
                    
                    if clean_line and len(clean_line) > 10:
                        questions.append(clean_line)
                
                if len(questions) >= 3:
                    logger.info(f"Generated {len(questions)} contextual questions via Gemini")
                    return questions[:4]
            
        except Exception as e:
            logger.error(f"Error generating questions with Gemini: {str(e)}")
    
    logger.info("Using pattern-based question generation")
    return generate_pattern_based_questions(df, data_context, columns)

def generate_pattern_based_questions(df, data_context, columns):
    """Generate questions based on data patterns when Gemini is unavailable"""
    questions = []
    
    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
    
    categorical_cols = []
    for col in df.columns:
        if df[col].dtype == 'object' and df[col].nunique() < len(df) * 0.5:
            categorical_cols.append(col)
    
    if data_context == 'employee':
        if any('salary' in col.lower() for col in numeric_cols):
            salary_col = next((col for col in columns if 'salary' in col.lower()), None)
            if salary_col:
                questions.append(f"What is the average {salary_col.lower()}?")
                questions.append(f"Who has the highest {salary_col.lower()}?")
        
        if any('department' in col.lower() for col in categorical_cols):
            dept_col = next((col for col in columns if 'department' in col.lower()), None)
            if dept_col:
                questions.append(f"How many employees are in each {dept_col.lower()}?")
        
        questions.append("Show me the employee details")
        questions.append("How many total employees are there?")
        
    elif data_context == 'sales':
        if numeric_cols:
            questions.append(f"What is the total {numeric_cols[0].lower()}?")
            questions.append(f"What is the average {numeric_cols[0].lower()}?")
        
        if any('customer' in col.lower() for col in categorical_cols):
            questions.append("Which customer has the most transactions?")
        
        questions.append("Show me the top 10 records by value")
        questions.append("What is the sales distribution?")
        
    elif data_context == 'supply_chain':
        questions.extend([
            "What is the highest quantity ordered?",
            "Show me all cancelled orders",
            "Which supplier has the most orders?",
            "What's the total value of all orders?"
        ])
        
    else:
        if numeric_cols:
            questions.append(f"What is the average {numeric_cols[0]}?")
            questions.append(f"Show me records with highest {numeric_cols[0]}")
        
        if categorical_cols:
            questions.append(f"How many unique {categorical_cols[0]} are there?")
            questions.append(f"Show me the distribution of {categorical_cols[0]}")
        
        questions.extend([
            "Show me a sample of the data",
            "How many total records are there?"
        ])
    
    while len(questions) < 6:
        questions.append("Show me a summary of the data")
    
    return questions[:6]

def load_csv_to_sqlite(df, table_name="supply_chain_data"):
    """Convert CSV to SQLite table"""
    try:
        conn = sqlite3.connect(':memory:')
        df.to_sql(table_name, conn, if_exists='replace', index=False)
        logger.info(f"Data loaded to SQLite table '{table_name}' with {len(df)} rows")
        return conn, table_name
    except Exception as e:
        logger.error(f"Error loading data to SQLite: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading data to SQLite: {str(e)}")

def get_table_metadata(conn, table_name):
    """Get table structure for metadata"""
    try:
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = cursor.fetchall()
        
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
        sample_data = cursor.fetchall()
        
        metadata = {
            'columns': [col[1] for col in columns_info],
            'column_types': [(col[1], col[2]) for col in columns_info],
            'sample_data': sample_data,
            'total_rows': len(current_dataframe) if current_dataframe is not None else 0
        }
        
        logger.info(f"Table metadata retrieved: {len(metadata['columns'])} columns, {metadata['total_rows']} rows")
        return metadata
    except Exception as e:
        logger.error(f"Error getting metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting metadata: {str(e)}")


def generate_sql_query_gemini(user_question, metadata, table_name, api_key=None):
    """Generate SQL query using Gemini with fallback to pattern matching"""
    
    columns = metadata['columns']
    
    client_to_use = gemini_client
    if api_key:
        client_to_use = GeminiClient(model="gemini-2.5-flash", api_key=api_key)  # Specify model
    
    if client_to_use.test_connection():
        logger.info("Using Gemini to generate SQL query")
        
        columns_str = ", ".join([f"{col[0]} ({col[1]})" for col in metadata['column_types']])
        sample_str = str(metadata['sample_data'][:2]) if metadata['sample_data'] else "No sample data"
        numeric_cols = [col[0] for col in metadata['column_types'] if col[1].lower() in ['integer', 'real', 'numeric']]
        text_cols = [col[0] for col in metadata['column_types'] if col[1].lower() in ['text', 'varchar']]
        
        system_prompt = """You are a SQL expert for data analysis.
CORE RESPONSIBILITIES:
- Convert natural language to precise SQLite queries
- Prioritize business-relevant insights
- Handle ambiguous requests intelligently

OUTPUT REQUIREMENTS:
- Return ONLY the SQL query (no explanations, markdown, or code blocks)
- Use proper SQLite syntax with backticks for column names containing spaces
- Limit results to 100 rows unless specifically asking for totals/aggregations

QUERY OPTIMIZATION RULES:
1. For "show me" requests: SELECT relevant columns with meaningful ORDER BY
2. For "how many" requests: Use COUNT() with appropriate GROUP BY
3. For "top/highest/best" requests: Use ORDER BY DESC with LIMIT
4. For "average/total" requests: Use appropriate aggregation functions
5. For date-related queries: Use proper date functions and formatting

ERROR PREVENTION:
- Always use backticks around column names with spaces or special characters
- Use LIKE '%term%' for partial text matching
- Handle potential NULL values appropriately
- Use proper data type casting when needed"""
        
        prompt = f"""DATASET ANALYSIS:
- Table name: {table_name}
- Columns: {columns_str}
- Sample data: {sample_str}
- Total rows: {metadata['total_rows']}

Rules:
1. Return ONLY the SQL query, no explanations
2. Use proper SQLite syntax
3. Use backticks for column names with spaces
4. For business insights, use appropriate aggregations
5. Limit large result sets to 100 rows unless asking for totals

COLUMN TYPES:
- Numeric columns: {numeric_cols}
- Text columns: {text_cols}

User Question: {user_question}

SQL Query:"""

        try:
            sql_query = client_to_use.generate_response(prompt, system_prompt)
            
            if sql_query:
                if sql_query.startswith('```'):
                    lines = sql_query.split('\n')
                    sql_query = '\n'.join(line for line in lines if not line.strip().startswith('```'))
                
                if sql_query.lower().startswith('sql'):
                    sql_query = sql_query[3:].strip()
                
                sql_query = sql_query.strip().rstrip(';')
                logger.info(f"Generated SQL query via Gemini: {sql_query}")
                return sql_query
            else:
                logger.warning("Gemini returned empty response, falling back to pattern matching")
        
        except Exception as e:
            logger.error(f"Error with Gemini SQL generation: {str(e)}")
    else:
        logger.info("Gemini not available, using pattern matching")
    

def execute_query(conn, sql_query):
    """Execute the SQL query"""
    try:
        logger.info(f"Executing SQL query: {sql_query}")
        cursor = conn.cursor()
        cursor.execute(sql_query)
        results = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        
        if results:
            data = []
            for row in results:
                data.append(dict(zip(columns, row)))
            logger.info(f"Query executed successfully, returned {len(data)} rows")
            return data, columns
        else:
            logger.info("Query executed successfully, returned 0 rows")
            return [], columns
    
    except Exception as e:
        logger.error(f"SQL execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"SQL execution error: {str(e)}")

# API Endpoints
@app.get("/")
async def root():
    return {"message": "supply_chain_data, API with Gemini", "status": "running"}

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload and process CSV file"""
    global current_dataframe, current_connection
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        df_clean = df.copy()
        df_clean = df_clean.where(pd.notnull(df_clean), None)
        
        current_dataframe = df_clean
        current_connection, table_name = load_csv_to_sqlite(df_clean)
        
        data_context, confidence, column_names = detect_data_type_and_context(df_clean)
        
        sample_data = df_clean.head(3).fillna("N/A").to_dict('records')
        
        logger.info(f"CSV uploaded successfully: {len(df_clean)} records, {len(df_clean.columns)} columns")
        logger.info(f"Detected data context: {data_context} (confidence: {confidence:.2f})")
        
        return {
            "success": True,
            "message": f"File uploaded successfully. Loaded {len(df_clean)} records with {len(df_clean.columns)} columns",
            "rows": len(df_clean),
            "columns": list(df_clean.columns),
            "sample_data": sample_data,
            "data_context": data_context,
            "context_confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/sample-questions", response_model=SampleQuestionsResponse)
async def get_sample_questions(api_key: Optional[str] = None):
    """Get contextual sample questions based on uploaded data"""
    
    if current_dataframe is None:
        raise HTTPException(status_code=400, detail="No data uploaded. Please upload a CSV file first.")
    
    try:
        data_context, confidence, column_names = detect_data_type_and_context(current_dataframe)
        
        questions = generate_contextual_sample_questions(current_dataframe, data_context, api_key)
        
        return SampleQuestionsResponse(
            questions=questions,
            data_type=data_context,
            columns_analyzed=column_names
        )
        
    except Exception as e:
        logger.error(f"Error generating sample questions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating sample questions: {str(e)}")

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """Process natural language query and return results"""
    
    if current_dataframe is None or current_connection is None:
        raise HTTPException(status_code=400, detail="No data uploaded. Please upload a CSV file first.")
    
    try:
        logger.info(f"Processing query: {request.query}")
        
        metadata = get_table_metadata(current_connection, request.table_name)
        
        sql_query = generate_sql_query_gemini(
            request.query, 
            metadata, 
            request.table_name,
            request.api_key
        )
        
        data, columns = execute_query(current_connection, sql_query)
        
        # Generate AI-powered summary
        ai_summary = None
        if data:  # Only generate summary if there are results
            ai_summary = generate_ai_summary(
                request.query,
                data,
                sql_query,
                request.api_key
            )
        
        return QueryResponse(
            success=True,
            data=data,
            columns=columns,
            question=request.query,
            sql_query=sql_query,
            message=f"Query executed successfully. Found {len(data)} results.",
            ai_summary=ai_summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger