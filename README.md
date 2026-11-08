@startuml
skinparam backgroundColor #FFFFFF
skinparam defaultTextAlignment center

actor "Клиент / Внешняя система" as Client
participant "API Gateway" as Gateway
participant "Integration Microservice\n(Node.js / TypeScript)" as Service
database "PostgreSQL\n(Idempotency / State)" as DB
database "Legacy Oracle\n(CDC / Streams)" as Oracle

== Обработка входящего запроса ==
Client -> Gateway: POST /api/v1/transaction
Gateway -> Service: Перенаправление запроса
Service -> DB: Проверка Idempotency Key
alt Ключ существует
    Service --> Client: 200 OK / Возврат кэшированного ответа
else Новый запрос
    Service -> Oracle: Запись транзакции в Legacy DB
    Oracle --> Service: Подтверждение (ACK)
    Service -> DB: Сохранение стейта + Идемпотентность
    Service --> Client: 201 Created
end

== Синхронизация через CDC ==
Oracle -> Service: CDC Event (Изменение в таблице)
Service -> Service: Обработка с Exponential Backoff\n(при сбоях сети)
@enduml
