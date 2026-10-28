# FreeLLMAPI oficial fixado em uma versão para deploy reproduzível.
FROM ghcr.io/tashfeenahmed/freellmapi:v0.16.10
ENV NODE_ENV=production
ENV PORT=3001
COPY startup-guard.sh /usr/local/bin/sra-luck-startup-guard.sh
ENTRYPOINT ["/bin/sh", "/usr/local/bin/sra-luck-startup-guard.sh"]
CMD ["node", "server/dist/index.js"]
EXPOSE 3001
