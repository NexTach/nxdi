# NexTach Global Dividend Income Fund

**NXDI · 넥스태치 글로벌 배당 인컴 펀드**

글로벌 고배당 ETF와 개별 종목으로 구성한 인컴 포트폴리오의 운용 현황, 배당 정책과 공시를 공개합니다.

- [상품설명](/client/content/product-description.md)
- [배당 정책](/client/content/dividend-policy.md)
- [LICENSE](/LICENSE)

## 구조

- `client`: Next.js 프런트엔드. Vercel에서 배포하며 브라우저의 `/api/*` 요청을 백엔드로 프록시합니다.
- `server`: Node.js 24, Fastify, Prisma 기반 백엔드. Docker로 Mac mini에 배포합니다.
- `server/deploy`: Docker Compose, Nginx 연결, DB 테이블 이름 전환 및 배포 생명주기 훅입니다.
- `docs/plans`: 분리 작업의 조사 결과와 구현 명세입니다.

백엔드는 가격 스냅샷, 전일 마감, 배당 동기화와 차트 선반영을 내부 스케줄러에서 실행합니다. 중복 실행은 MySQL named lock으로 막고, 외부 차트는 fresh/stale 캐시로 일시적인 외부 지연을 사용자 요청에서 분리합니다.

## 로컬 실행

Node.js 24가 필요합니다.

```bash
cd server
cp .env.example .env
npm ci
npm run dev
```

다른 터미널에서 다음을 실행합니다.

```bash
cd client
npm ci
API_ORIGIN=http://127.0.0.1:3000 npm run dev
```

각 디렉터리에서 `npm run verify`로 lint, 타입 검사, 단위 테스트와 서버 빌드를 검증할 수 있습니다.

## 배포

- `client/**` 변경은 Vercel 프로젝트의 Root Directory `client` 설정으로 배포합니다.
- `server/**` 변경이 `main`에 push되면 GitHub Actions가 SSH Remote Deploy 1.2.1로 서버만 배포합니다.
- 서버 환경 변수 전문은 GitHub의 `SERVER_ENV` secret에서 배포 시 `.env`로 생성되며 권한은 `0600`입니다.
- 컨테이너는 `127.0.0.1:10104`에만 바인딩되고 Nginx의 `/nxdi-api/` 경로를 통해 노출됩니다.
- DB는 `tb_` 접두사의 snake_case 이름으로 통일된 9개 테이블을 사용하며, 완료된 전환 백업은 배포 스크립트가 제거합니다.
- 배포 중 Docker 정리는 MySQL·Redis와 마운트된 컨테이너·named volume을 보호하고, 오래된 미사용 컨테이너·이미지·익명 volume·build cache만 정리합니다.
