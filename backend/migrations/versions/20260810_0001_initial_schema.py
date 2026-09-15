"""Create the initial application schema.

This revision is intended for new production databases. Existing installations
must be backed up, upgraded once with the legacy initializer, and then stamped.
"""
from alembic import op

from app.database import Base

revision = "20260810_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    raise RuntimeError("The initial production schema cannot be downgraded automatically")
