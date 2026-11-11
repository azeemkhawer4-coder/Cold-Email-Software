import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateTemplate, extractTemplateVariables } from './templateEngine';

test('interpolateTemplate replaces variables when present', () => {
  const tpl = 'Hi {{first_name}}, I noticed {{company}} is scaling rapidly.';
  const lead = { first_name: 'Alex', company: 'Acme Corp' };
  const result = interpolateTemplate(tpl, lead);
  assert.equal(result, 'Hi Alex, I noticed Acme Corp is scaling rapidly.');
});

test('interpolateTemplate handles camelCase alias mappings', () => {
  const tpl = 'Hello {{first_name}} {{last_name}}, role: {{job_title}}';
  const lead = { firstName: 'Sarah', lastName: 'Connor', jobTitle: 'VP Growth' };
  const result = interpolateTemplate(tpl, lead);
  assert.equal(result, 'Hello Sarah Connor, role: VP Growth');
});

test('interpolateTemplate uses fallback value when variable is missing or empty', () => {
  const tpl = 'Hi {{first_name | fallback: "there"}}, how is work at {{company | fallback: "your company"}}?';
  const lead = { first_name: '', company: null };
  const result = interpolateTemplate(tpl, lead);
  assert.equal(result, 'Hi there, how is work at your company?');
});

test('interpolateTemplate supports lead customFields and fallback', () => {
  const tpl = 'Stack: {{infra_stack | fallback: "Kubernetes"}}, priority: {{quarterly_priority | fallback: "efficiency"}}';
  const lead = {
    customFields: {
      infra_stack: 'Multi-Region AWS EKS',
    },
  };
  const result = interpolateTemplate(tpl, lead);
  assert.equal(result, 'Stack: Multi-Region AWS EKS, priority: efficiency');
});

test('extractTemplateVariables identifies all unique variable names', () => {
  const tpl = 'Hi {{first_name | fallback: "there"}}, is {{company}} still in {{city}}? Best, {{first_name}}';
  const vars = extractTemplateVariables(tpl);
  assert.deepEqual(vars.sort(), ['city', 'company', 'first_name'].sort());
});
