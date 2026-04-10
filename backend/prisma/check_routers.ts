import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const routers = await prisma.router.findMany({
        select: {
            id: true,
            name: true,
            wireguardIp: true,
            deletedAt: true,
        }
    });
    console.log('Routers in DB:');
    console.log(JSON.stringify(routers, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
