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

class GeminiSettings(BaseModel):
    model: str = "gemini-1.5-flash"
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
    def __init__(self, model="gemini-1.5-flash", api_key=None):
        self.model = model
        self.api_key = api_key or DEFAULT_API_KEY
        self.temperature = 0.0
        self.top_p = 0.9
        self._configure_client()
    
    def _configure_client(self):
        """Configure the Gemini client with API key"""
        try:
            if self.api_key and self.api_key != "YOUR_DEFAULT_API_KEY_HERE":
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
            return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]
    
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
gemini_client = GeminiClient()

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

        system_prompt = """You are an expert data analyst. Generate 6 relevant sample questions that should relate to the dataset provided and that users would typically ask about their dataset.
Rules:
1. Return EXACTLY 6 questions, one per line
2. Questions should be natural language, not technical
3. Base questions on the actual column names and data patterns
4. Make questions practical and business-relevant
5. Use the exact column names from the data
6. Don't use quotation marks around the questions
7. Each question should be different and explore different aspects of the data"""
        
        prompt = f"""Dataset Analysis:
Data Context: {data_context}
Columns: {', '.join(columns)}
Sample Data (first 2 rows): {clean_sample}
Total Rows: {len(df)}

Based on this {data_context} dataset, generate 6 sample questions that would be relevant for analysis.
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
                    return questions[:6]
            
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

def generate_pattern_based_sql(user_question, table_name, columns):
    """Generate SQL using pattern matching as fallback"""
    question_lower = user_question.lower()
    
    if "highest" in question_lower and "quantity" in question_lower:
        if "Quantity" in columns:
            return f"SELECT * FROM {table_name} ORDER BY Quantity DESC LIMIT 1"
    elif "lowest" in question_lower and "price" in question_lower:
        price_col = next((col for col in columns if "price" in col.lower()), None)
        if price_col:
            return f"SELECT * FROM {table_name} ORDER BY `{price_col}` ASC LIMIT 1"
    elif "count" in question_lower:
        return f"SELECT COUNT(*) as total_count FROM {table_name}"
    elif "total" in question_lower and "quantity" in question_lower:
        if "Quantity" in columns:
            return f"SELECT SUM(Quantity) as total_quantity FROM {table_name}"
    elif "cancelled" in question_lower or "canceled" in question_lower:
        status_col = next((col for col in columns if "status" in col.lower()), None)
        if status_col:
            return f"SELECT * FROM {table_name} WHERE `{status_col}` LIKE '%Cancel%'"
    elif "supplier" in question_lower and "most" in question_lower:
        supplier_col = next((col for col in columns if "supplier" in col.lower()), None)
        if supplier_col:
            return f"SELECT `{supplier_col}`, COUNT(*) as order_count FROM {table_name} GROUP BY `{supplier_col}` ORDER BY order_count DESC LIMIT 5"
    elif "average" in question_lower and "price" in question_lower:
        price_col = next((col for col in columns if "price" in col.lower()), None)
        if price_col:
            return f"SELECT AVG(`{price_col}`) as avg_price FROM {table_name}"
    elif "show" in question_lower or "display" in question_lower or "list" in question_lower:
        return f"SELECT * FROM {table_name} LIMIT 10"
    
    return f"SELECT * FROM {table_name} LIMIT 10"

def generate_sql_query_gemini(user_question, metadata, table_name, api_key=None):
    """Generate SQL query using Gemini with fallback to pattern matching"""
    
    columns = metadata['columns']
    
    client_to_use = gemini_client
    if api_key:
        client_to_use = GeminiClient(api_key=api_key)
    
    if client_to_use.test_connection():
        logger.info("Using Gemini to generate SQL query")
        
        columns_str = ", ".join([f"{col[0]} ({col[1]})" for col in metadata['column_types']])
        sample_str = str(metadata['sample_data'][:2]) if metadata['sample_data'] else "No sample data"
        
        system_prompt = """You are a SQL expert for data analysis.
Convert natural language questions to precise SQLite queries.
Return ONLY the SQL query, no explanations or formatting.
Always use backticks around column names that might have spaces or special characters."""
        
        prompt = f"""Database Information:
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
    
    fallback_query = generate_pattern_based_sql(user_question, table_name, columns)
    logger.info(f"Generated SQL query via pattern matching: {fallback_query}")
    return fallback_query

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
    return {"message": "Supply Chain Analytics API with Gemini", "status": "running"}

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
        
        return QueryResponse(
            success=True,
            data=data,
            columns=columns,
            question=request.query,
            sql_query=sql_query,
            message=f"Query executed successfully. Found {len(data)} results."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return QueryResponse(
            success=False,
            data=[],
            columns=[],
            question=request.query,
            message=f"Error processing query: {str(e)}"
        )

@app.get("/gemini/status")
async def gemini_status():
    """Check Gemini API connection status"""
    is_connected = gemini_client.test_connection()
    models = gemini_client.get_available_models()
    
    return {
        "connected": is_connected,
        "current_model": gemini_client.model,
        "available_models": models,
        "api_key_configured": bool(gemini_client.api_key and gemini_client.api_key != "YOUR_DEFAULT_API_KEY_HERE")
    }

@app.post("/gemini/settings")
async def update_gemini_settings(settings: GeminiSettings):
    """Update Gemini settings"""
    global gemini_client
    
    if settings.api_key:
        gemini_client.update_api_key(settings.api_key)
    
    gemini_client.model = settings.model
    gemini_client.temperature = settings.temperature
    gemini_client.top_p = settings.top_p
    
    gemini_client._configure_client()
    
    is_connected = gemini_client.test_connection()
    
    return {
        "success": True,
        "connected": is_connected,
        "message": f"Settings updated. Model: {settings.model}, API Key configured: {bool(settings.api_key)}"
    }

@app.post("/gemini/test-api-key")
async def test_api_key(request: ApiKeyRequest):
    """Test if provided API key works"""
    try:
        test_client = GeminiClient(api_key=request.api_key)
        is_working = test_client.test_connection()
        
        if is_working:
            available_models = test_client.get_available_models()
            return {
                "success": True,
                "message": "API key is valid and working",
                "available_models": available_models
            }
        else:
            return {
                "success": False,
                "message": "API key test failed. Please check your key."
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"API key test failed: {str(e)}"
        }

@app.get("/data/overview")
async def data_overview():
    """Get overview of current dataset"""
    if current_dataframe is None:
        raise HTTPException(status_code=400, detail="No data uploaded")
    
    df = current_dataframe.copy()
    
    def safe_value_counts(series):
        """Get value counts and convert to JSON-safe format"""
        counts = series.value_counts()
        return {str(k): int(v) for k, v in counts.head(10).items()}
    
    data_context, confidence, column_names = detect_data_type_and_context(df)
    
    overview = {
        "total_records": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "data_types": {k: str(v) for k, v in df.dtypes.to_dict().items()},
        "missing_values": {k: int(v) for k, v in df.isnull().sum().to_dict().items()},
        "sample_data": df.head(5).fillna("N/A").to_dict('records'),
        "detected_context": data_context,
        "context_confidence": confidence
    }
    
    categorical_cols = []
    for col in df.columns:
        if df[col].dtype == 'object' and df[col].nunique() < len(df) * 0.5:
            categorical_cols.append(col)
    
    if categorical_cols:
        overview[f"{categorical_cols[0].lower()}_distribution"] = safe_value_counts(df[categorical_cols[0]])
    
    return overview

@app.get("/test-query")
async def test_query():
    """Test endpoint to verify basic functionality"""
    if current_dataframe is None or current_connection is None:
        return {"error": "No data uploaded"}
    
    try:
        cursor = current_connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM supply_chain_data")
        result = cursor.fetchone()
        
        return {
            "success": True,
            "message": f"Database connection working. Total rows: {result[0]}",
            "columns": list(current_dataframe.columns),
            "gemini_status": gemini_client.test_connection()
        }
    except Exception as e:
        return {"error": f"Database test failed: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)

#.\querybot_env\Scripts\Activate.ps1
#uvicorn QBback:app --reload --host 0.0.0.0 --port 8000
