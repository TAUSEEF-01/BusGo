from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.admin import router as admin_router

app = FastAPI(title="admin-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(admin_router)

@app.get("/")
async def root():
    return {"message": "admin-service is running on port 8011"}
