#!/bin/sh

protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/common/v1/environment.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/common/v1/gateway.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/common/v1/address.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/integrations/v1/order.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/integrations/v1/event_data.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/jobs/v1/integration_event_job.proto

# Public api dependencies
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/common/v1/push_notifications.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/dashboard/v1/audiobooks.proto
protoc --proto_path=../instapay/proto --es_out ./src/gen/proto --es_opt target=ts ../instapay/proto/public/v1/public_api.proto
