/** RFC 2606 / 6761 reserved names: used by test scripts, never deliverable (avoids bounces). */
const RESERVED = /@(?:[^@]+\.)?(?:example\.(?:com|net|org)|[^@]+\.(?:test|invalid|example|localhost))$/i;
export const isReservedAddress = (to: string) => RESERVED.test(to.trim());
