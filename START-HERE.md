# Deploy Qareeb on Vercel (only)

Use **this** ZIP. You do **not** need Render. You do **not** paste SQL. You do **not** add `VITE_API_URL`.

The website, API, shops, orders and images all run on **Vercel**. Vercel still needs a free Postgres database (Neon), created from the same Vercel page.

## 1. Put the code on GitHub

Extract the ZIP. Upload the **inside** of the `qareeb` folder so GitHub shows these at the root:

```
api/
client/
server/
supabase/
package.json
vercel.json
```

## 2. Import the repo in Vercel

1. Open [https://vercel.com/new](https://vercel.com/new)
2. Import the GitHub repo
3. **Root Directory:** empty (or `./`). **Not** `client`
4. **Framework Preset:** Other
5. **Delete** any `VITE_API_URL` variable (that old value was wrong)
6. Do **not** add Supabase keys. They are optional now.

## 3. Add a database (this is the one extra click)

Still in that Vercel project:

1. Open the **Storage** tab
2. **Create Database**
3. Choose **Neon** (or Postgres)
4. Create it and **connect it to this project**
5. Wait until it says **Connected**

Vercel will add `POSTGRES_URL` or `DATABASE_URL` by itself. You do not type a password into the Environment Variables box.

## 4. Deploy

Click **Deploy**. If the project already deployed once, click **Redeploy**.

Open the Vercel website. The first load can take up to a minute while Qareeb creates the shops.

## 5. Sign in

| Role | Email | Password |
| --- | --- | --- |
| Customer | `ali@demo.com` | `password123` |
| Shop owner | `madina@demo.com` | `password123` |
| Rider | `rider1@demo.com` | `password123` |
| Admin | `admin@qareeb.app` | `password123` |

Those buttons are also on the login screen.

## If the page says “Add a database”

The Storage database is not connected yet.

- Storage → your database → connect this project → **Redeploy**
- Root Directory is not `client`
- `VITE_API_URL` is deleted

Do not send passwords or secret keys in chat.

Hobby/free plans are for personal testing. Provider signup rules can change; a card-free database is not guaranteed forever. Change demo passwords before real customers. Card/JazzCash/EasyPaisa payments in the app are simulated.
