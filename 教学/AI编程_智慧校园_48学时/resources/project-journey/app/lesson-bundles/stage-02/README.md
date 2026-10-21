# 第02站 首次HTTP读取

模式：first-chain；无数据库

目标：从真实HTTP响应显示两台设备

契约：GET /api/auth/csrf、/auth/me、/campus/capabilities；GET /campus/devices、/spaces，code=0再取items/observedAt

人工过关：登录后读取true/null两设备；业务失败不冒充空列表

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/App.vue
- foundation：backend/.gitignore
- foundation：backend/.mvn/wrapper/maven-wrapper.jar
- foundation：backend/.mvn/wrapper/maven-wrapper.properties
- foundation：backend/README.md
- foundation：backend/docs/debug-read-pagination.md
- foundation：backend/docs/full-api.json
- foundation：backend/docs/round10-read-api.json
- foundation：backend/mvnw
- foundation：backend/mvnw.cmd
- foundation：backend/pom.xml
- foundation：backend/src/main/java/edu/campus/course/Access.java
- foundation：backend/src/main/java/edu/campus/course/AccountAdmin.java
- foundation：backend/src/main/java/edu/campus/course/AccountDirectory.java
- foundation：backend/src/main/java/edu/campus/course/AiriotReadOnlyProvider.java
- foundation：backend/src/main/java/edu/campus/course/ApiErrors.java
- foundation：backend/src/main/java/edu/campus/course/ApiFailure.java
- foundation：backend/src/main/java/edu/campus/course/ApiResponse.java
- foundation：backend/src/main/java/edu/campus/course/AuthController.java
- foundation：backend/src/main/java/edu/campus/course/CampusController.java
- foundation：backend/src/main/java/edu/campus/course/CampusMapper.java
- foundation：backend/src/main/java/edu/campus/course/CampusProvider.java
- foundation：backend/src/main/java/edu/campus/course/CatalogReader.java
- foundation：backend/src/main/java/edu/campus/course/CommandAuditController.java
- foundation：backend/src/main/java/edu/campus/course/CoreBeans.java
- foundation：backend/src/main/java/edu/campus/course/CourseApplication.java
- foundation：backend/src/main/java/edu/campus/course/CourseModels.java
- foundation：backend/src/main/java/edu/campus/course/DatabaseSetup.java
- foundation：backend/src/main/java/edu/campus/course/DbAccountDirectory.java
- foundation：backend/src/main/java/edu/campus/course/FullCampusController.java
- foundation：backend/src/main/java/edu/campus/course/Inputs.java
- foundation：backend/src/main/java/edu/campus/course/LocalAccountDirectory.java
- foundation：backend/src/main/java/edu/campus/course/LocationService.java
- foundation：backend/src/main/java/edu/campus/course/MockCampusProvider.java
- foundation：backend/src/main/java/edu/campus/course/OperationsService.java
- foundation：backend/src/main/java/edu/campus/course/QualityPolicy.java
- foundation：backend/src/main/java/edu/campus/course/SecurityConfiguration.java
- foundation：backend/src/main/java/edu/campus/course/SelectedCampusProvider.java
- foundation：backend/src/main/java/edu/campus/course/TeachingReadSamples.java
- foundation：backend/src/main/resources/application-first-chain.properties
- foundation：backend/src/main/resources/application-teacher-db.properties
- foundation：backend/src/main/resources/application.properties
- foundation：backend/src/main/resources/db/migration/V1__local_campus.sql
- foundation：backend/src/main/resources/db/migration/V2__full_teaching_business.sql
- foundation：backend/src/test/java/edu/campus/course/CatalogReaderTest.java
- foundation：backend/src/test/java/edu/campus/course/CloseRulesTest.java
- foundation：backend/src/test/java/edu/campus/course/FirstChainTest.java
- foundation：backend/src/test/java/edu/campus/course/HistoryFixtureTest.java
- foundation：backend/src/test/java/edu/campus/course/LocalAccountDirectoryTest.java
- foundation：backend/src/test/java/edu/campus/course/QualityPolicyTest.java
- foundation：backend/src/test/java/edu/campus/course/ReadFixtureValidationTest.java
- foundation：backend/src/test/java/edu/campus/course/ReadOnlyModelsTest.java
- foundation：backend/src/test/java/edu/campus/course/SnapshotConsistencyTest.java
- foundation：backend/src/test/java/edu/campus/course/SourceSelectionTest.java
- foundation：backend/src/test/java/edu/campus/course/TeacherDbTest.java
- foundation：backend/src/test/resources/catalog-test.json
- foundation：backend/tools/account-admin.mjs
- foundation：backend/tools/test-mysql.mjs
- foundation：fixtures/README.md
- foundation：fixtures/catalog.json
- foundation：fixtures/command-audit.json
- foundation：fixtures/concurrency-rollback-scenarios.json
- foundation：fixtures/history-cases.json
- foundation：fixtures/history-series.json
- foundation：fixtures/manifest.json
- foundation：fixtures/pagination-scenarios.json
- foundation：fixtures/permission-scenarios.json
- foundation：fixtures/quality-cases.json
- foundation：fixtures/raw-alarms.json
- foundation：fixtures/schema.md
- foundation：fixtures/selectors.json
- foundation：tools/course.mjs
- foundation：tools/private-json.mjs
- foundation：tools/validate-fixtures.mjs
- foundation：docs/02-教师数据库交接单.md
- assembly：frontend/src/views/FullWorkspace.vue
- foundation：frontend/src/stores/campus.ts
- foundation：frontend/src/api/auth.ts
- foundation：frontend/src/domain/course.ts
- foundation：frontend/src/types/campus.ts
- foundation：frontend/src/api/http.ts
- foundation：frontend/src/types/full.ts
- foundation：frontend/src/api/campus.ts
- business：frontend/src/views/FirstDeviceRead.vue
- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- foundation：frontend/src/tests/first-device-view.test.ts
- foundation：frontend/src/tests/http.test.ts
- foundation：frontend/src/tests/request-timeout.test.ts
- foundation：frontend/src/tests/session-races.test.ts
