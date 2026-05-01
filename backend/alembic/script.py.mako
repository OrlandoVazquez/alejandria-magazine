# This script is used by Alembic to generate migration files.
# Please refer to the documentation in "The Migration Environment" section.

file_template = %%(rev)s_%%(slug)s

sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy.engine

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy.engine]
level = INFO
handlers =
qualname = sqlalchemy.engine

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
