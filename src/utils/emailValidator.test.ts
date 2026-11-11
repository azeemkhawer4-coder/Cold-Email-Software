import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmailSyntax, parseCsvRows, autoDetectColumnMappings } from './emailValidator';

test('validateEmailSyntax accepts valid email format', () => {
  const result = validateEmailSyntax('alex.miller@stripe.com');
  assert.equal(result.isValidSyntax, true);
  assert.equal(result.domain, 'stripe.com');
  assert.equal(result.status, 'valid');
});

test('validateEmailSyntax detects invalid email format', () => {
  const result = validateEmailSyntax('not-an-email');
  assert.equal(result.isValidSyntax, false);
  assert.equal(result.status, 'invalid');
});

test('validateEmailSyntax marks disposable emails as risky', () => {
  const result = validateEmailSyntax('test@mailinator.com');
  assert.equal(result.isValidSyntax, true);
  assert.equal(result.isDisposable, true);
  assert.equal(result.status, 'risky');
});

test('parseCsvRows handles quoted commas and spaces', () => {
  const csv = 'First Name,Last Name,Email,Company\n"John, Jr.",Doe,john@acme.com,"Acme, Inc."\nJane,Smith,jane@tech.co,TechCorp';
  const { headers, rows } = parseCsvRows(csv);
  assert.deepEqual(headers, ['First Name', 'Last Name', 'Email', 'Company']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['First Name'], 'John, Jr.');
  assert.equal(rows[0]['Company'], 'Acme, Inc.');
});

test('autoDetectColumnMappings maps common header variations', () => {
  const headers = ['First_Name', 'Job Title', 'Email Address', 'Company Name', 'LinkedIn URL'];
  const mapping = autoDetectColumnMappings(headers);
  assert.equal(mapping.firstName, 'First_Name');
  assert.equal(mapping.jobTitle, 'Job Title');
  assert.equal(mapping.email, 'Email Address');
  assert.equal(mapping.company, 'Company Name');
  assert.equal(mapping.linkedinUrl, 'LinkedIn URL');
});
