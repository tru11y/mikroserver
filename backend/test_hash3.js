const argon2 = require('argon2');

async function test() {
    const hash = '$argon2id$v=19$m=65536,t=3,p=4$peE+sgyoUquQxvEONmB66w$aPYKEkd2NQA8UtXMWW86REzIsRCpmh+zWKdZANgf62GM';
    console.log('Testing hash:', hash);
    
    try {
        const result = await argon2.verify(hash, 'Admin123!');
        console.log('Verify Admin123!:', result);
    } catch (e) {
        console.error('Error:', e.message);
        console.error('Stack:', e.stack);
    }
}

test();