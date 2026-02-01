import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
})

async function deleteCompanyData() {
    try {
        // 1. Delete all companyName:userAddress keys
        const companyNameKeys = await redis.keys('companyName:*')
        if (companyNameKeys.length > 0) {
            await redis.del(...companyNameKeys)
            console.log(`Deleted ${companyNameKeys.length} company name keys`)
        }

        // 2. Delete global company names list
        await redis.del('companyNames')
        console.log('Deleted global company names list')

        // 3. Delete all companyUsers:companyName keys
        const companyUsersKeys = await redis.keys('companyUsers:*')
        if (companyUsersKeys.length > 0) {
            await redis.del(...companyUsersKeys)
            console.log(`Deleted ${companyUsersKeys.length} company users lists`)
        }

        console.log('Company data cleanup completed successfully')
    } catch (error) {
        console.error('Error cleaning up company data:', error)
    }
}

// Execute the cleanup
deleteCompanyData()
