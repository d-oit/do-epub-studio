FROM node:22-bookworm-slim

ARG EPUBCHECK_VERSION=5.4.0
ENV NODE_ENV=production PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jre-headless ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/epubcheck \
  && curl --fail --location --silent --show-error \
    "https://github.com/w3c/epubcheck/releases/download/v${EPUBCHECK_VERSION}/epubcheck-${EPUBCHECK_VERSION}.zip" \
    -o /tmp/epubcheck.zip \
  && unzip /tmp/epubcheck.zip -d /opt/epubcheck \
  && mv "/opt/epubcheck/epubcheck-${EPUBCHECK_VERSION}/epubcheck.jar" /opt/epubcheck/epubcheck.jar \
  && rm -rf /tmp/epubcheck.zip "/opt/epubcheck/epubcheck-${EPUBCHECK_VERSION}"
WORKDIR /service/apps/epubcheck-runner
COPY apps/epubcheck-runner/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY packages/shared ./packages/shared
COPY apps/epubcheck-runner/src ./src
EXPOSE 8080
USER node
CMD ["npm", "start"]
