from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.repositories.activity_log_repository import (
    ActivityLogRepository,
)
from app.infrastructure.persistence.repositories.capacity_assessment_repository import (
    CapacityAssessmentRepository,
)
from app.infrastructure.persistence.repositories.document_repository import (
    DocumentRepository,
)
from app.infrastructure.persistence.repositories.import_history_repository import (
    ImportHistoryRepository,
)
from app.infrastructure.persistence.repositories.notification_repository import (
    NotificationRepository,
)
from app.infrastructure.persistence.repositories.project_part_repository import (
    ProjectPartRepository,
)
from app.infrastructure.persistence.repositories.project_repository import (
    ProjectRepository,
)
from app.infrastructure.persistence.repositories.risk_repository import (
    RiskRepository,
)
from app.infrastructure.persistence.repositories.supplier_repository import (
    SupplierRepository,
)
from app.infrastructure.persistence.repositories.user_repository import (
    UserRepository,
)


class UnitOfWork:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._user_repo: UserRepository | None = None
        self._project_repo: ProjectRepository | None = None
        self._project_part_repo: ProjectPartRepository | None = None
        self._supplier_repo: SupplierRepository | None = None
        self._capacity_assessment_repo: CapacityAssessmentRepository | None = (
            None
        )
        self._risk_repo: RiskRepository | None = None
        self._document_repo: DocumentRepository | None = None
        self._notification_repo: NotificationRepository | None = None
        self._activity_log_repo: ActivityLogRepository | None = None
        self._import_history_repo: ImportHistoryRepository | None = None

    @property
    def users(self) -> UserRepository:
        if self._user_repo is None:
            self._user_repo = UserRepository(self._session)
        return self._user_repo

    @property
    def projects(self) -> ProjectRepository:
        if self._project_repo is None:
            self._project_repo = ProjectRepository(self._session)
        return self._project_repo

    @property
    def project_parts(self) -> ProjectPartRepository:
        if self._project_part_repo is None:
            self._project_part_repo = ProjectPartRepository(self._session)
        return self._project_part_repo

    @property
    def suppliers(self) -> SupplierRepository:
        if self._supplier_repo is None:
            self._supplier_repo = SupplierRepository(self._session)
        return self._supplier_repo

    @property
    def capacity_assessments(self) -> CapacityAssessmentRepository:
        if self._capacity_assessment_repo is None:
            self._capacity_assessment_repo = CapacityAssessmentRepository(
                self._session
            )
        return self._capacity_assessment_repo

    @property
    def risks(self) -> RiskRepository:
        if self._risk_repo is None:
            self._risk_repo = RiskRepository(self._session)
        return self._risk_repo

    @property
    def documents(self) -> DocumentRepository:
        if self._document_repo is None:
            self._document_repo = DocumentRepository(self._session)
        return self._document_repo

    @property
    def notifications(self) -> NotificationRepository:
        if self._notification_repo is None:
            self._notification_repo = NotificationRepository(self._session)
        return self._notification_repo

    @property
    def activity_logs(self) -> ActivityLogRepository:
        if self._activity_log_repo is None:
            self._activity_log_repo = ActivityLogRepository(self._session)
        return self._activity_log_repo

    @property
    def import_history(self) -> ImportHistoryRepository:
        if self._import_history_repo is None:
            self._import_history_repo = ImportHistoryRepository(self._session)
        return self._import_history_repo

    @property
    def session(self) -> AsyncSession:
        return self._session

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

    async def close(self) -> None:
        await self._session.close()

    async def __aenter__(self) -> UnitOfWork:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        if exc_type is None:
            await self.commit()
        else:
            await self.rollback()
        await self.close()
