const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "..", "aura-189b1-firebase-adminsdk-fbsvc-b80495de06.json"));

const app = admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  console.log("Listing all Firebase Auth users...");
  
  const listResult = await auth.listUsers(100);
  const users = listResult.users;
  
  if (users.length === 0) {
    console.log("No users found. Register first via the app.");
    process.exit(1);
  }
  
  console.log(`Found ${users.length} user(s):`);
  for (const user of users) {
    console.log(`  - ${user.email} (${user.uid})`);
  }
  
  // Check existing roles in Firestore
  console.log("\nChecking Firestore roles...");
  const usersSnapshot = await db.collection("users").get();
  const existingRoles = {};
  usersSnapshot.forEach(doc => {
    existingRoles[doc.id] = doc.data().role;
  });
  console.log("Existing roles:", existingRoles);
  
  // Find first user without admin role
  const targetUser = users.find(u => existingRoles[u.uid] !== "admin");
  
  if (!targetUser) {
    console.log("\nAll users already have admin role.");
    process.exit(0);
  }
  
  console.log(`\nPromoting ${targetUser.email} to admin...`);
  
  // Set admin role in Firestore
  await db.collection("users").doc(targetUser.uid).set({
    uid: targetUser.uid,
    email: targetUser.email,
    displayName: targetUser.displayName || targetUser.email.split("@")[0],
    role: "admin",
    branch: null,
    spotName: null,
    createdAt: new Date(),
  }, { merge: true });
  
  // Set custom claim for Firebase Auth
  await auth.setCustomUserClaims(targetUser.uid, { role: "admin" });
  
  console.log(`\n✓ ${targetUser.email} is now admin!`);
  console.log("Refresh the page and log in again to see admin features.");
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
