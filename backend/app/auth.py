import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict

import jwt
from passlib.context import CryptContext


class AuthManager:
    """Minimal authentication helper for the single-user admin flow."""

    def __init__(self, secret: str | None = None, db_path: str | Path | None = None) -> None:
        self.secret = secret or os.environ.get("AUTH_SECRET", "change-me")
        self.db_path = Path(db_path or os.environ.get("AUTH_FILE", Path(__file__).with_name("auth.json")))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self._data = self._load()

    def _load(self) -> Dict:
        if self.db_path.exists():
            with self.db_path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        return {"user": None}

    def _save(self) -> None:
        with self.db_path.open("w", encoding="utf-8") as fh:
            json.dump(self._data, fh, indent=2)

    def is_setup(self) -> bool:
        return bool(self._data.get("user"))

    def register(self, username: str, password: str) -> Dict:
        if self.is_setup():
            raise ValueError("Administrator already configured")
        password_hash = self.pwd_context.hash(password)
        self._data["user"] = {"username": username, "password_hash": password_hash}
        self._save()
        return {"username": username}

    def authenticate(self, username: str, password: str) -> str:
        user = self._data.get("user")
        if not user:
            raise ValueError("Setup required before login")
        if user.get("username") != username:
            raise ValueError("Invalid credentials")
        if not self.pwd_context.verify(password, user.get("password_hash")):
            raise ValueError("Invalid credentials")
        return self._issue_token(username)

    def _issue_token(self, username: str) -> str:
        expiry = datetime.now(tz=timezone.utc) + timedelta(hours=12)
        payload = {"sub": username, "exp": expiry}
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def verify_token(self, token: str | None) -> str | None:
        if not token:
            return None
        try:
            payload = jwt.decode(token, self.secret, algorithms=["HS256"])
        except jwt.PyJWTError:
            return None
        return payload.get("sub")

    def current_user(self) -> Dict | None:
        return self._data.get("user")

