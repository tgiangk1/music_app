import { generateRecommendations } from './src/services/recommendations.js';
import { initDatabase } from './src/config/database.js';

// Initialize database
initDatabase();

// Test with first user
const userId = '487f2b3f-b78d-40b9-bc5b-49ea89d8ee6f';
console.log('Testing recommendations for user:', userId);

try {
    const recommendations = generateRecommendations(userId);
    console.log('Recommendations found:', recommendations.length);
    console.log('First recommendation:', JSON.stringify(recommendations[0], null, 2));

    if (recommendations.length > 0) {
        console.log('\nRecommendations working! Here are the top 3:');
        recommendations.slice(0, 3).forEach((rec, i) => {
            console.log(`${i + 1}. ${rec.title} (${rec.channel_name}) - Score: ${rec.totalScore} - Reason: ${rec.reason}`);
        });
    } else {
        console.log('No recommendations found. This could mean:');
        console.log('- User has no activity history');
        console.log('- No songs in the database meet criteria');
        console.log('- Database needs more data');
    }
} catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
}