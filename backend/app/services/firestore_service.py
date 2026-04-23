"""
Firestore service — abstraction layer for all Firestore operations.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from google.cloud import firestore


_client: Optional[firestore.Client] = None


def get_client() -> firestore.Client:
    global _client
    if _client is None:
        _client = firestore.Client()
    return _client


# ── Generic CRUD ─────────────────────────────────────────────

async def create_document(
    collection: str, data: Dict[str, Any], doc_id: Optional[str] = None
) -> str:
    """Create a document, returns the document ID."""
    client = get_client()
    doc_id = doc_id or str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc)
    data["updated_at"] = datetime.now(timezone.utc)
    client.collection(collection).document(doc_id).set(data)
    return doc_id


async def get_document(collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
    """Get a single document by ID."""
    client = get_client()
    doc = client.collection(collection).document(doc_id).get()
    if doc.exists:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None


async def update_document(
    collection: str, doc_id: str, data: Dict[str, Any]
) -> bool:
    """Update fields on an existing document."""
    client = get_client()
    data["updated_at"] = datetime.now(timezone.utc)
    client.collection(collection).document(doc_id).update(data)
    return True


async def delete_document(collection: str, doc_id: str) -> bool:
    """Delete a document."""
    client = get_client()
    client.collection(collection).document(doc_id).delete()
    return True


async def list_documents(
    collection: str,
    filters: Optional[List[tuple]] = None,
    order_by: Optional[str] = None,
    order_direction: str = "DESCENDING",
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List documents with optional filters, ordering, and pagination."""
    client = get_client()
    query = client.collection(collection)

    if filters:
        for field, op, value in filters:
            query = query.where(field, op, value)

    if order_by:
        direction = (
            firestore.Query.DESCENDING
            if order_direction == "DESCENDING"
            else firestore.Query.ASCENDING
        )
        query = query.order_by(order_by, direction=direction)

    query = query.limit(limit).offset(offset)

    results = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)

    return results


async def count_documents(
    collection: str, filters: Optional[List[tuple]] = None
) -> int:
    """Count documents matching filters."""
    client = get_client()
    query = client.collection(collection)
    if filters:
        for field, op, value in filters:
            query = query.where(field, op, value)
    # Use aggregation query for efficient counting
    count = 0
    for _ in query.stream():
        count += 1
    return count


# ── Organization-scoped helpers ──────────────────────────────

async def get_org_collection(org_id: str, sub_collection: str):
    """Get a reference to an organization-scoped sub-collection."""
    client = get_client()
    return client.collection("organizations").document(org_id).collection(sub_collection)


async def create_org_document(
    org_id: str, sub_collection: str, data: Dict[str, Any], doc_id: Optional[str] = None
) -> str:
    """Create a document in an org-scoped sub-collection."""
    client = get_client()
    doc_id = doc_id or str(uuid.uuid4())
    data["org_id"] = org_id
    data["created_at"] = datetime.now(timezone.utc)
    data["updated_at"] = datetime.now(timezone.utc)
    (
        client.collection("organizations")
        .document(org_id)
        .collection(sub_collection)
        .document(doc_id)
        .set(data)
    )
    return doc_id


async def list_org_documents(
    org_id: str,
    sub_collection: str,
    limit: int = 50,
    order_by: Optional[str] = "created_at",
) -> List[Dict[str, Any]]:
    """List documents from an org-scoped sub-collection."""
    client = get_client()
    query = (
        client.collection("organizations")
        .document(org_id)
        .collection(sub_collection)
    )
    if order_by:
        query = query.order_by(order_by, direction=firestore.Query.DESCENDING)
    query = query.limit(limit)

    results = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    return results
