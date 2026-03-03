////////////////////////////////////////////////////////////////////////////////
// Prepare test environment
////////////////////////////////////////////////////////////////////////////////

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

function extractFunctionSource(html, functionName) {
    const startMarker = `function ${functionName}(`
    const startIndex = html.indexOf(startMarker)
    if (startIndex < 0) {
        throw new Error(`Cannot find function: ${functionName}`)
    }

    const openBraceIndex = html.indexOf('{', startIndex)
    let braceDepth = 0
    for (let index = openBraceIndex; index < html.length; index++) {
        const character = html[index]
        if (character === '{') {
            braceDepth++
        }
        else if (character === '}') {
            braceDepth--
            if (braceDepth === 0) {
                return html.slice(startIndex, index + 1)
            }
        }
    }

    throw new Error(`Cannot parse function body: ${functionName}`)
}

function createConvertEnvironment() {
    const indexHtmlPath = path.resolve(__dirname, '../index_en.html')
    const html = fs.readFileSync(indexHtmlPath, 'utf8')

    const parseFunctionSource = extractFunctionSource(html, 'parse_keilc51_reg_addrs')
    const convertFunctionSource = extractFunctionSource(html, 'convert_keilc51_to_sdcc')

    const context = {
        window: {
            location: { href: 'http://localhost/index_en.html' },
        },
        console,
    }

    vm.createContext(context)
    vm.runInContext(`${parseFunctionSource}\n${convertFunctionSource}`, context)

    return {
        convert_keilc51_to_sdcc: context.convert_keilc51_to_sdcc,
        context,
    }
}

////////////////////////////////////////////////////////////////////////////////
// Test cases
////////////////////////////////////////////////////////////////////////////////

test('convert_keilc51_to_sdcc works for keywords', () => {
    const env = createConvertEnvironment()

    const codeKeil = 'typedef unsigned char data UINT8D;'
    const codeHeader = ''
    const output = env.convert_keilc51_to_sdcc(codeKeil, codeHeader)

    assert.ok(output.includes('typedef unsigned char __data UINT8D;'))
})

test('convert_keilc51_to_sdcc works for sbit statements', () => {
    const env = createConvertEnvironment()

    const codeKeil = 'sbit OV            = PSW^2;        // overflow flag'
    const codeHeader = 'sfr PSW             = 0xD0;'
    const output = env.convert_keilc51_to_sdcc(codeKeil, codeHeader)

    assert.ok(output.includes('SBIT( OV            , 0xD0/*PSW*/, 2);        // overflow flag'))
})

test('convert_keilc51_to_sdcc contains header information', () => {
    const env = createConvertEnvironment()

    const codeKeil = 'sbit OV            = PSW^2;        // overflow flag'
    const codeHeader = 'sfr PSW             = 0xD0;'
    const output = env.convert_keilc51_to_sdcc(codeKeil, codeHeader)

    const expected = `// Converted code as follows
//
////////////////////////////////////////////////////////////////
#include <compiler.h>    // Please download this header file on this website (http://localhost/index_en.html).
SBIT( OV            , 0xD0/*PSW*/, 2);        // overflow flag
`

    assert.equal(output, expected)
})

test('convert_keilc51_to_sdcc empty C51 code test', () => {
    const env = createConvertEnvironment()

    const codeKeil = ''
    const codeHeader = 'sfr PSW             = 0xD0;'
    const output = env.convert_keilc51_to_sdcc(codeKeil, codeHeader)

    const expected = `// Converted code as follows
//
////////////////////////////////////////////////////////////////
#include <compiler.h>    // Please download this header file on this website (http://localhost/index_en.html).

`

    assert.equal(output, expected)
})
