// Test asciichart min/max options
const asciichart = require('asciichart');

const data = [-12.5, -12.5, -14, -15, -18, -19.5, -19.5];

console.log('=== Test 1: WITHOUT min/max ===');
console.log(asciichart.plot(data, { height: 6 }));

console.log('');
console.log('=== Test 2: WITH min=-22, max=22 ===');
try {
    console.log(asciichart.plot(data, { height: 8, min: -22, max: 22 }));
} catch (e) {
    console.log('Error:', e.message);
}

console.log('');
console.log('=== Test 3: With format function ===');
const config = {
    height: 8,
    min: -22,
    max: 22,
    format: (x) => Math.abs(x).toFixed(0).padStart(3)
};
try {
    console.log(asciichart.plot(data, config));
} catch (e) {
    console.log('Error:', e.message);
}
