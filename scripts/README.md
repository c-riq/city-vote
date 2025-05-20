# Scripts

## sync-backend-types

Syncs backend types to frontend.

```bash
npm run sync-backend-types
```

**Sources:**
- Types: `serverless/*/src/types.ts` → `frontend/src/backendTypes.ts`
- Countries: `serverless/autocomplete/src/countries.ts` → `frontend/src/countries.ts`

## Notes

- Uses ES modules
- Requires `tsx` for execution
