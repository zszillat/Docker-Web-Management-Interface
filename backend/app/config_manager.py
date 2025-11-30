import json
import os
from pathlib import Path
from typing import Dict


class ConfigManager:
    """Persisted configuration for the UI and Docker helpers."""

    def __init__(self, path: str | Path | None = None) -> None:
        default_path = Path(__file__).with_name("config.json")
        self.path = Path(path or os.environ.get("APP_CONFIG", default_path))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._data = self._load()

    @staticmethod
    def _defaults() -> Dict:
        return {
            "stack_root": os.environ.get("STACK_ROOT", "/mnt/storage/yaml"),
            "frontend_port": 18675,
            "theme": "light",
        }

    def _load(self) -> Dict:
        if self.path.exists():
            with self.path.open("r", encoding="utf-8") as fh:
                saved = json.load(fh)
            defaults = self._defaults()
            defaults.update(saved)
            return defaults
        return self._defaults()

    def save(self, payload: Dict) -> Dict:
        self._data.update(payload)
        with self.path.open("w", encoding="utf-8") as fh:
            json.dump(self._data, fh, indent=2)
        return self._data

    def get_config(self) -> Dict:
        return dict(self._data)

