import aioboto3
from core.config import settings

class S3Service:
    @staticmethod
    async def upload_file(file_bytes: bytes, key: str, content_type: str) -> str:
        session = aioboto3.Session()
        async with session.client('s3',
                                  endpoint_url=settings.S3_ENDPOINT_URL,
                                  aws_access_key_id=settings.S3_ACCESS_KEY,
                                  aws_secret_access_key=settings.S3_SECRET_KEY) as client:
            
            # Ensure bucket exists (for dev)
            try:
                await client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
            except:
                await client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
                
            await client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
                ACL='public-read'
            )
            
            return f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{key}"
