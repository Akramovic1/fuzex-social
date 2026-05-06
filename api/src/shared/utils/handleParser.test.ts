import { parseHandle, type ParseHandleResult } from './handleParser.js';

describe('parseHandle', () => {
  const DOMAIN = '.dev.fuzex.app';

  it('extracts a single-label username', () => {
    const result = parseHandle('akram.dev.fuzex.app', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: true, username: 'akram' });
  });

  it('strips a port suffix from the host', () => {
    const result = parseHandle('akram.dev.fuzex.app:443', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: true, username: 'akram' });
  });

  it('lowercases the input', () => {
    const result = parseHandle('AKRAM.DEV.FUZEX.APP', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: true, username: 'akram' });
  });

  it('rejects nested subdomains', () => {
    const result = parseHandle('evil.akram.dev.fuzex.app', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: false, reason: 'CONTAINS_SUBDOMAINS' });
  });

  it('rejects a host whose suffix does not match', () => {
    const result = parseHandle('akram.example.com', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: false, reason: 'NOT_MATCHING_DOMAIN' });
  });

  it('rejects empty input', () => {
    const result = parseHandle('', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: false, reason: 'EMPTY_INPUT' });
  });

  it('rejects empty domain', () => {
    const result = parseHandle('akram.dev.fuzex.app', '');
    expect(result).toEqual<ParseHandleResult>({ ok: false, reason: 'EMPTY_DOMAIN' });
  });

  it('rejects domain suffix without leading dot', () => {
    const result = parseHandle('akram.dev.fuzex.app', 'dev.fuzex.app');
    expect(result).toEqual<ParseHandleResult>({ ok: false, reason: 'INVALID_DOMAIN_SUFFIX' });
  });

  it('rejects bare domain (empty username)', () => {
    const result = parseHandle('.dev.fuzex.app', DOMAIN);
    expect(result).toEqual<ParseHandleResult>({ ok: false, reason: 'EMPTY_USERNAME' });
  });
});
