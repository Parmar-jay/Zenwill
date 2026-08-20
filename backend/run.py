"""
ZenWill Backend — Entry point
Run: python run.py

Prerequisites:
  1. MongoDB must be running (default: mongodb://localhost:27017)
  2. Configure .env with your MONGODB_URL and SECRET_KEY
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
