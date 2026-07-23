from slowapi import Limiter
from slowapi.util import get_remote_address

# Singleton compartilhado entre todos os routers
limiter = Limiter(key_func=get_remote_address)
