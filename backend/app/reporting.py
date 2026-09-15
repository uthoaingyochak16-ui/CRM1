from datetime import datetime

from sqlalchemy.orm import Session

from . import models


def task_stage_summary(
    db: Session,
    start: datetime,
    end: datetime,
    executive_id: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """Return completed-task stage totals and real stage changes for a period."""
    # Task timestamps are stored in a timezone-naive SQL ``DateTime`` column.
    # Dashboard boundaries may be Bangladesh-time aware, so normalize the
    # boundaries to the same representation before both SQL and Python
    # comparisons. The wall-clock time remains unchanged.
    query_start = start.replace(tzinfo=None) if start.tzinfo is not None else start
    query_end = end.replace(tzinfo=None) if end.tzinfo is not None else end

    query = db.query(models.Task).filter(
        models.Task.status == "completed",
        models.Task.completed_at < query_end,
        models.Task.stage != "",
    )
    if executive_id is not None:
        query = query.filter(models.Task.assigned_to == executive_id)

    tasks = query.order_by(models.Task.completed_at, models.Task.id).all()
    stage_counts: dict[str, int] = {}
    conversion_counts: dict[tuple[str, str], int] = {}

    previous_stages: dict[tuple[str, object], str] = {}
    for task in tasks:
        current_stage = (task.stage or "").strip()
        if not current_stage:
            continue
        context = ("root", task.root_task_id or task.id) if task.root_task_id else (("customer", task.customer_id) if task.customer_id else None)
        previous_stage = previous_stages.get(context, "") if context else ""
        if task.completed_at >= query_start:
            stage_counts[current_stage] = stage_counts.get(current_stage, 0) + 1
        if task.completed_at >= query_start and previous_stage and previous_stage != current_stage:
            key = (previous_stage, current_stage)
            conversion_counts[key] = conversion_counts.get(key, 0) + 1
        if context:
            previous_stages[context] = current_stage

    stages = [
        {"stage": stage, "count": count}
        for stage, count in sorted(stage_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    conversions = [
        {"from_stage": source, "to_stage": target, "count": count}
        for (source, target), count in sorted(
            conversion_counts.items(), key=lambda item: (-item[1], item[0][0], item[0][1])
        )
    ]
    return stages, conversions
