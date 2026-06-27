from extensions import db
from models.book import Book


def lock_book(book_id):
    """
    Acquire a row-level lock on a Book for the current transaction.

    PostgreSQL: SELECT ... FOR UPDATE SKIP LOCKED
      - Non-blocking: if the row is already locked by another transaction, returns
        None immediately instead of waiting. The caller responds with 409 so the
        client can retry.

    SQLite: plain SELECT
      - SQLite serialises concurrent writers at the database level (WAL / journal
        mode), so a separate FOR UPDATE is unnecessary. TOCTOU on the copy-count
        is covered by the atomic conditional UPDATE used at the write site.
    """
    q = Book.query.filter_by(id=book_id)
    if db.engine.dialect.name != 'sqlite':
        q = q.with_for_update(skip_locked=True)
    return q.first()
