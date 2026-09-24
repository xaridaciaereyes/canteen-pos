# Canteen POS

A simple tablet app for the canteen: take orders, track stock, track staff attendance and pay, record sales and expenses, and view daily, weekly and monthly reports.

- **Take Order**: tabs for Breakfast, Lunch, Merienda, Snacks and Others. Rice options (with / half / no rice), Dine-in / No container / With container, extra rice. Payment: Cash (asks the amount received and shows the change), GCash, Others (PayMaya, Bank Transfer).
- **Today's Menu**: add today's dishes. Every dish is saved by type (Breakfast, Beef, Pork, Chicken, Fish, Veggies, Merienda), so next time you add it with one tap. The menu starts empty every new day.
- **Orders & Sales**: every order made that day with totals per payment method. You can edit or void an order (password needed), and every change is kept in the order's **History**.
- **Inventory**: Snacks (Chips, Drinks, Candies, Snacks, Groceries), Others (meals like katsu) and Supplies (tissues, plates, spoon & fork, plastics). Stock goes down with every order. Alerts show when something is low or about to expire. The **End of day report** asks about supplies, then gives a report you can copy and paste.
- **Employees** (owner): daily attendance (Present / Late / Absent) with a smiley rating for each person, and **Payroll** by week or month. Downloadable (CSV).
- **Expenses** (owner): what you bought or paid for. Staff pay is added automatically.
- **Dashboard** (owner): sales vs expenses, target gauge, orders per item, busiest hours, best sellers, staff ratings, and **Download (CSV)**.
- **Settings** (owner): incentives, inventory rules, passwords, prices.
- **Accounts** (owner): a username and password for each person, with Cashier, Staff or Custom access.

---

## Step 0: Add your logo

Save your logo image in this folder with the name **`logo.png`**. The app trims the white space around it automatically once it runs from GitHub Pages (Step 3). When you double-click `index.html`, the logo shows without the trimming.

## Step 1: Try it (demo mode, no setup)

Double-click `index.html` to open it in Chrome or Edge. Sign in with username **`owner`**, password **`akotosishypanget`**.
In demo mode, data is saved **only on that device**. Use it to practice, then continue to Step 2.

---

## Step 2: Set up free cloud saving (Firebase, about 15 minutes)

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Create a project**. Name it, for example, `canteen-pos`. You can turn off Google Analytics. Click **Create**.
3. **Add a web app:** on the project home page, click the **`</>`** (Web) icon. Name it `canteen`. Do **not** tick "Firebase Hosting". Click **Register app**.
   Firebase shows a block of code with `const firebaseConfig = { apiKey: ..., ... }`. **Copy the part inside the `{ }`.**
4. Open `firebase-config.js` in Notepad. Replace `null` with what you copied:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "canteen-pos.firebaseapp.com",
     projectId: "canteen-pos",
     storageBucket: "canteen-pos.appspot.com",
     messagingSenderId: "123...",
     appId: "1:123...:web:abc..."
   };
   ```
5. **Create the database:** in the left menu, open **Build → Firestore Database → Create database**.
   Choose location **asia-southeast1 (Singapore)**, then **Start in production mode**, then **Create**.
6. **Create the owner login:** go to **Build → Authentication → Get started → Email/Password**, turn on **Enable**, then **Save**.
   Open the **Users** tab, click **Add user**, and type the owner's email and a password.
   Then, in `firebase-config.js`, put that email in `window.OWNER_EMAIL = "..."`.
7. **Protect the data:** go to **Firestore Database → Rules**. Delete everything there, paste the contents of `firestore.rules`,
   **replace `YOUR-OWNER-EMAIL@example.com` with the owner email from step 6**, then click **Publish**.

That's it. The free plan (Spark) is enough for one canteen. Staff accounts are created inside the app (**Accounts** page), not in Firebase.

> The `apiKey` in `firebase-config.js` is not a secret; it's normal for it to be public. The data is protected by the logins and the rules from step 7.

---

## Step 3: Put it online with GitHub Pages (free)

1. On <https://github.com>, click **New repository**. Name it `canteen-pos` and choose **Public**. (The free GitHub plan requires Public for Pages. Your sales data is **not** in the files; it's in Firebase.) Click **Create repository**.
2. Click **uploading an existing file**. Drag in **all the files** from this folder, including `logo.png`. Click **Commit changes**.
3. Go to **Settings → Pages**. Under "Branch", choose **main** and **/ (root)**, then click **Save**.
4. Wait 1–2 minutes and refresh. The address appears, for example `https://YOUR-USERNAME.github.io/canteen-pos/`.

**To update the app later**, upload the changed file again. Tablets get the new version the next time the app is opened while online.

---

## Step 4: Install on the tablet

- **Android (Chrome):** open the GitHub Pages address, tap **⋮ → Add to Home screen** (or **Install app**).
- **iPad (Safari):** open the address, tap **Share (□↑) → Add to Home Screen**.

Sign in once. It stays signed in until someone taps **Sign out / switch user** at the bottom of the side menu.
If the internet drops, keep selling. Orders are saved on the tablet and sent to the cloud when the internet comes back.

---

## Accounts

The owner opens **Accounts → Add account** and chooses:
- **Cashier**: Take Order, Today's Menu, Orders & Sales.
- **Staff**: Inventory only (including the end of day report).
- **Custom**: tick the pages that person can open.

Each person signs in with their own username and password. **Turn off** an account when someone leaves.
In cloud mode, the app can't reset another person's password. Turn the old account off and create a new one.

---

## Daily use (quick guide)

1. **Morning:** **Today's Menu**. Tap **Add** next to the dishes you're serving, **New Dish** for something new, or **Copy last menu**.
2. **Selling:** **Take Order**. Tap the food, choose the rice and Dine-in / No container / With container, then pay:
   - **Paid – Cash**: tap the amount received (Exact, ₱50 … ₱1,000) or type it. The change is shown. Tap **OK – next order**.
   - **Paid – GCash** or **Paid – Others**: saved right away.
   Wrong button? Tap **Undo** on the message at the bottom.
3. **Mistake in an earlier order:** **Orders & Sales → Edit**. Enter the password, fix it, and type the reason. Stock is corrected automatically.
4. **New stock arrived:** **Inventory → Add stock** (or **Add item** for something new). For snacks it asks the kind, price, quantity (exact or approximate), expiry date, and when to remind you to restock (2 by default).
5. **Staff:** **Employees**. Tap Present, Late or Absent, then a face to rate.
6. **End of day:** **Inventory → End of day report**. Type how many tissues were used, check the other supplies (already computed), then tap **Make the report** → **Copy report** and paste it in your group chat.

## Inventory rules

- Snacks and Others go down by the quantity sold. Voided orders put the stock back.
- **Paper plates and spoon & fork** go down by 1 for each Lunch meal served with **No container** or **With container**. Dine-in doesn't count. You can change which meals and choices count in **Settings → Inventory**.
- Tissues and plastics are updated in the end of day report.
- **Alerts** (top bar) show items at or below their restock number, and items expiring within 7 days (changeable in Settings).

## Staff pay and incentives

Set these in **Settings → Staff incentives**: a rating incentive (daily / weekly / monthly, an amount for each smiley), a sales bonus ("if sales reach ₱X, each person who worked gets ₱Y"), and a late deduction.
Pay = daily wage for each Present or Late day + rating incentive + sales bonus. It goes into Expenses and the Dashboard automatically.

## Good to know

- When the **owner** is signed in, the owner pages ask for the owner password again (default `akotosishypanget`, change it in Settings). They lock again after 15 minutes without tapping. This protects the tablet if the owner leaves it signed in.
- The edit-order password is `akotosishypanget` at first. Change it or turn it off in **Settings**.
- To back up: Dashboard → Monthly → **Download sales data (CSV)**. The file opens in Excel or Google Sheets.
