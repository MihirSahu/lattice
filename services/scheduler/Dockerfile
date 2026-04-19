FROM alpine:3.20

RUN apk add --no-cache bash curl

WORKDIR /app

COPY services/scheduler/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]

