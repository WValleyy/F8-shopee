import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
    serializeJsonForHtml,
} from '../../../utils/serialize-json-for-html.js';

// HTML-embedded JSON serialization remains safe and deterministic.
describe('serializeJsonForHtml', () => {
    it('serializes an undefined optional value as JSON null', () => {
        assert.equal(serializeJsonForHtml(undefined), 'null');
    });

    it('escapes characters that can break out of an inline script', () => {
        const serialized = serializeJsonForHtml({
            value: '</script><script>alert("xss")</script>&',
            separators: '\u2028\u2029',
        });

        assert.equal(serialized.includes('</script>'), false);
        assert.equal(serialized.includes('<script>'), false);
        assert.equal(serialized.includes('&'), false);
        assert.ok(serialized.includes('\\u003c/script\\u003e'));
        assert.ok(serialized.includes('\\u2028\\u2029'));
        assert.deepEqual(JSON.parse(serialized), {
            value: '</script><script>alert("xss")</script>&',
            separators: '\u2028\u2029',
        });
    });
});
