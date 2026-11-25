import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};

const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');

test('normalizeItemSchema preserves rollKind:"opposed" with opposedStatKey and opposedFormula', () => {
  const norm = Selector.normalizeItemSchema({
    name: 'Agarre táctico',
    steps: [
      {
        type: 'roll',
        rollKind: 'opposed',
        label: 'Agarre',
        formula: '1d20+@fue',
        opposedStatKey: 'dex',
        opposedFormula: '1d20+@des'
      }
    ]
  });
  assert.equal(norm.steps.length, 1);
  assert.equal(norm.steps[0].rollKind, 'opposed');
  assert.equal(norm.steps[0].opposedStatKey, 'dex');
  assert.equal(norm.steps[0].opposedFormula, '1d20+@des');
});

test('evaluateRollAgainstRequest evaluates opposed rolls (win, tie, loss, and 0-total)', () => {
  const req = { evalMode: 'opposed', opposed: true, casterTotal: 14, dc: 14 };
  assert.deepEqual(Selector.evaluateRollAgainstRequest(req, { total: 16 }), {
    status: 'pass',
    badge: '✓',
    detail: 'Gana objetivo (vs 14)'
  });
  assert.deepEqual(Selector.evaluateRollAgainstRequest(req, { total: 14 }), {
    status: 'partial',
    badge: '=',
    detail: 'Empate (vs 14)'
  });
  assert.deepEqual(Selector.evaluateRollAgainstRequest(req, { total: 10 }), {
    status: 'fail',
    badge: '✗',
    detail: 'Gana atacante (vs 14)'
  });

  const zeroReq = { evalMode: 'opposed', opposed: true, casterTotal: 0, dc: 0 };
  assert.equal(Selector.evaluateRollAgainstRequest(zeroReq, { total: 0 }).status, 'partial');
  assert.equal(Selector.evaluateRollAgainstRequest(zeroReq, { total: 1 }).status, 'pass');
});

test('buildWireRollRequest forwards opposed, casterTotal, casterName and respects secretDc', () => {
  const openWire = Selector.buildWireRollRequest({
    requestId: 'r1',
    senderId: 'gm1',
    label: 'Agarre',
    statKey: 'dex',
    formula: '1d20+@des',
    dc: 15,
    opposed: true,
    casterTotal: 15,
    casterName: 'Kaelen',
    targets: [{ id: 't2', name: 'Trasgo' }],
    secretDc: false
  });
  assert.equal(openWire.opposed, true);
  assert.equal(openWire.casterTotal, 15);
  assert.equal(openWire.casterName, 'Kaelen');
  assert.equal(openWire.dc, 15);

  const secretWire = Selector.buildWireRollRequest({
    requestId: 'r2',
    senderId: 'gm1',
    label: 'Sigilo',
    statKey: '',
    formula: '1d20',
    dc: 18,
    opposed: true,
    casterTotal: 18,
    casterName: 'Vex',
    targets: [{ id: 't2', name: 'Guardia' }],
    secretDc: true
  });
  assert.equal(secretWire.opposed, true);
  assert.equal(secretWire.dc, 0);
  assert.equal(secretWire.casterTotal, undefined);
});

test('Service opposed roll step rolls caster, sends symmetric or asymmetric request, and resolves for GM', () => {
  const prevState = Service.state;
  const prevRollFormula = Service.rollFormula;
  const prevNotify = Service.notify;
  const prevRecordEvent = Service.recordEvent;

  try {
    const rollCalls = [];
    Service.notify = () => {};
    Service.recordEvent = () => {};
    Service.rollFormula = (formula, actor, label) => {
      rollCalls.push({ formula, actorId: actor?.id, label });
      return { total: actor?.id === 't1' ? 14 : 11, chosen: 10, sides: 20 };
    };
    Service.state = {
      role: 'gm',
      selectedTokenId: 't2',
      sheetSchema: [
        { key: 'str', label: 'FUE', alias: 'fue' },
        { key: 'dex', label: 'DES', alias: 'des' }
      ],
      systemConfig: {
        rollFormula: '1d20+@stat',
        stats: [
          { key: 'str', label: 'FUE', alias: 'fue' },
          { key: 'dex', label: 'DES', alias: 'des' }
        ]
      },
      tokens: [
        { id: 't1', name: 'Kaelen', stats: { str: 3, dex: 1 } },
        { id: 't2', name: 'Trasgo', stats: { str: 0, dex: 2 } }
      ],
      events: []
    };

    // 1. Symmetric default (no opposedStatKey / opposedFormula)
    Service.startItemSequence('t1', {
      name: 'Forcejeo',
      steps: [
        {
          type: 'roll',
          rollKind: 'opposed',
          label: 'Forcejeo',
          formula: '1d20+@fue'
        }
      ]
    });

    assert.equal(rollCalls.length, 1);
    assert.equal(rollCalls[0].formula, '1d20+@fue');
    assert.equal(Service.state.activeSequence.stepResults[0].total, 14);
    assert.equal(Service.state.activeSequence.stepResults[0].opposed, true);
    assert.equal(Service.state.activeRollRequest.opposed, true);
    assert.equal(Service.state.activeRollRequest.evalMode, 'opposed');
    assert.equal(Service.state.activeRollRequest.casterTotal, 14);
    assert.equal(Service.state.activeRollRequest.dc, 14);
    assert.equal(Service.state.activeRollRequest.formula, '1d20+@fue');

    // GM resolves target
    const resp = Service.resolveRollRequestTargetForGm('t2');
    assert.equal(resp.total, 11);
    assert.equal(Service.state.activeSequence.saveResults.t2.opposed, true);
    assert.equal(Service.state.activeSequence.saveResults.t2.casterTotal, 14);

    // 2. Asymmetric override via opposedStatKey
    Service.startItemSequence('t1', {
      name: 'Empujón',
      steps: [
        {
          type: 'roll',
          rollKind: 'opposed',
          label: 'Empujón',
          formula: '1d20+@fue',
          opposedStatKey: 'dex'
        }
      ]
    });
    assert.equal(Service.state.activeRollRequest.formula, '1d20+@des');

    // 3. Asymmetric override via explicit opposedFormula
    Service.startItemSequence('t1', {
      name: 'Finta',
      steps: [
        {
          type: 'roll',
          rollKind: 'opposed',
          label: 'Finta',
          formula: '1d20+@des',
          opposedFormula: '2d6+@fue'
        }
      ]
    });
    assert.equal(Service.state.activeRollRequest.formula, '2d6+@fue');
  } finally {
    Service.state = prevState;
    Service.rollFormula = prevRollFormula;
    Service.notify = prevNotify;
    Service.recordEvent = prevRecordEvent;
  }
});
