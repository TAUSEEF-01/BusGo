import asyncio
from pathlib import Path

from core.config import settings


class ArtifactStorage:
    @staticmethod
    async def save(file_bytes: bytes, filename: str) -> None:
        storage = Path(settings.FILE_STORAGE_PATH).resolve()
        storage.mkdir(parents=True, exist_ok=True)
        target = (storage / filename).resolve()
        if target.parent != storage:
            raise ValueError("Invalid ticket artifact filename")
        await asyncio.to_thread(target.write_bytes, file_bytes)

    @staticmethod
    def path(filename: str) -> Path:
        storage = Path(settings.FILE_STORAGE_PATH).resolve()
        target = (storage / filename).resolve()
        if target.parent != storage:
            raise ValueError("Invalid ticket artifact filename")
        return target
