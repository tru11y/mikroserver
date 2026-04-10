const argon2 = require('argon2');

async function test() {
    const hash = '$argon2id$v=19$m=65536,t=3,p=4$GEnKyJ2jJmpSAGvKwKB7pQ$d7llqt9MY8BSTdSvgHuGgg0PdfD37IX61bXudrdaE95Q';
    console.log('Hash length:', hash.length);
    console.log('Hash starts with $:', hash[0]);
    console.log('Hash:', hash);
    
    try {
        const result = await argon2.verify(hash, 'Admin123!');
        console.log('Verify Admin123!:', result);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();