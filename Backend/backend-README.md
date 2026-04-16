# ITC Backend API

Node.js / Express / MongoDB backend for Irish Tax Consulting internal tool.

## Setup

```bash
npm install
cp .env.example .env
# Fill in your MongoDB URI and JWT secret in .env
npm run dev   # development (nodemon)
npm start     # production
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Min 32 character secret for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry e.g. `8h` |
| `ALLOWED_ORIGIN` | Frontend URL for CORS |
| `NODE_ENV` | `development` or `production` |

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create adviser account |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Verify token |
| PATCH | `/api/auth/password` | Change password |

### Clients
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clients` | List clients (search, filter) |
| GET | `/api/clients/:id` | Single client + history |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/:id` | Update client |
| POST | `/api/clients/:id/history` | Add timeline note |
| DELETE | `/api/clients/:id` | Archive (soft) or hard delete |

### Returns
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/returns` | Queue view (filter by status, year, consultant) |
| GET | `/api/returns/:id` | Single return with snapshot |
| POST | `/api/returns` | Create return |
| PATCH | `/api/returns/:id` | Update fields |
| PATCH | `/api/returns/:id/status` | Change status + log |
| POST | `/api/returns/:id/history` | Add note |
| POST | `/api/returns/sync` | Bulk upsert from localStorage |
| DELETE | `/api/returns/:id` | Delete return |

### Calculations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/calculations/:returnId` | Save computation result |
| GET | `/api/calculations/:returnId` | Get latest result |
| GET | `/api/calculations/summary/year/:year` | Aggregate by year |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit` | Query audit log |
| POST | `/api/audit` | Write audit entry from frontend |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server + DB status |

## Authentication

All routes except `/api/auth/login` and `/api/health` require a Bearer token:

```
Authorization: Bearer <token>
```

## Data Migration from localStorage

The `/api/returns/sync` and `/api/clients` POST endpoints accept the same data structure
the HTML tool stores in localStorage. Use the `clientRef` / `returnRef` fields to match
browser-generated IDs to MongoDB documents.

## Security

- Rate limiting: 200 req/15min globally, 10 req/15min on auth
- Helmet.js security headers
- CORS restricted to configured origin
- Passwords hashed with bcrypt (12 rounds)
- JWT expiry configurable (default 8h)
- Audit logs auto-expire after 7 years (Revenue TCA 1997 s.469)
- GDPR: hard delete available for admin role (Article 17)
