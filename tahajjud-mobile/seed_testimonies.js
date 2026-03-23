const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTbpXPTn-wMBp821rMaoqOqdstNhzyRdM",
    authDomain: "tahajjud-2d7bf.firebaseapp.com",
    projectId: "tahajjud-2d7bf",
    storageBucket: "tahajjud-2d7bf.firebasestorage.app",
    messagingSenderId: "434827238021",
    appId: "1:434827238021:web:2a437aa88af1b360c1e7ec",
};

const initialTestimonies = [
    {
        id: '1',
        title: "The Job I Prayed For",
        body: "I was unemployed for 2 years. Rejections piled up, and I felt worthless. Then I started waking up 20 minutes before Fajr. I poured my heart out in Sujood. Two weeks later, I got a call for a job that was better than anything I applied for. Tahajjud opened doors that were sealed shut.",
        author: "Anonymous",
        location: "London, UK",
        reactions: 124,
        tags: ["Career", "Rizq"]
    },
    {
        id: '2',
        title: "Peace in the Chaos",
        body: "My anxiety was crippling. I couldn't sleep. One night, instead of tossing and turning, I made wudu and prayed. The silence of the night combined with the words of Allah healed something in me. Now, Tahajjud is my therapy. The anxiety is gone, replaced by a peace I can't explain.",
        author: "Sarah K.",
        location: "Toronto, Canada",
        reactions: 98,
        tags: ["Anxiety", "Health", "Peace"]
    },
    {
        id: '3',
        title: "A Broken Marriage Restored",
        body: "We were on the brink of divorce. Arguments every day. I started praying Tahajjud specifically for our hearts to soften. Slowly, the anger faded. We started communicating again. It's been a year, and we are happier than ever. Allah turns hearts.",
        author: "Anonymous",
        location: "Dubai, UAE",
        reactions: 156,
        tags: ["Marriage", "Family"]
    },
    {
        id: '4',
        title: "The Impossible Exam",
        body: "I had a medical board exam that everyone said was impossible to pass on the first try. I studied hard, but I trusted Allah more. I prayed Tahajjud every night for a month. On exam day, I felt a strange calm. I passed with flying colors. Success comes from Him.",
        author: "Dr. A.",
        location: "Cairo, Egypt",
        reactions: 87,
        tags: ["Education", "Success"]
    },
    {
        id: '5',
        title: "Forgiving Myself",
        body: "I carried guilt for years over past mistakes. I felt too ashamed to ask for forgiveness. But in the quiet of the night, I realized Allah's mercy is bigger than my sins. Crying in Tahajjud washed away the guilt. I finally feel free.",
        author: "Anonymous",
        location: "USA",
        reactions: 112,
        tags: ["Forgiveness", "Spiritual"]
    }
];

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

async function seed() {
    console.log("Seeding Firestore...");
    try {
        for (const t of initialTestimonies) {
            // We use 'community' collection because it is open in security rules
            const docRef = doc(db, 'community', `testimony_${t.id}`);
            await setDoc(docRef, {
                ...t,
                type: 'testimony',
                createdAt: Date.now() // Add timestamp
            });
            console.log(`Uploaded document: testimony_${t.id} - ${t.title}`);
        }
        console.log("Seeding completed successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Error seeding:", e);
        process.exit(1);
    }
}

seed();
