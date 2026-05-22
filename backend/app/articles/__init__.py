"""Compatibility package exposing `app.modules.articles` as `app.articles`."""
from app.modules.articles import *  # re-export existing articles module

__all__ = []
