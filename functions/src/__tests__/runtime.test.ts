import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { _resetRuntimeForTest, defaultApp, deps, firestore } from '../infra/runtime';

describe('runtime defaultApp and service initialization', () => {
  const cleanupApps = async () => {
    _resetRuntimeForTest();
    for (const app of getApps()) {
      await deleteApp(app);
    }
  };

  beforeEach(async () => {
    await cleanupApps();
  });

  afterEach(async () => {
    await cleanupApps();
  });

  it('initializes the [DEFAULT] app when no apps exist', () => {
    expect(getApps().length).toBe(0);
    const app = defaultApp();
    expect(app.name).toBe('[DEFAULT]');
    expect(getApps().length).toBe(1);
    expect(defaultApp()).toBe(app);
  });

  it('initializes the [DEFAULT] app even when a non-default app (__FIREBASE_FUNCTIONS_SDK__) exists first', () => {
    // Replicates Cloud Functions Gen 2 behavior where firebase-functions/v2
    // creates '__FIREBASE_FUNCTIONS_SDK__' during callable auth token verification.
    initializeApp({ projectId: 'ugc-mock-test-staging' }, '__FIREBASE_FUNCTIONS_SDK__');
    expect(getApps().length).toBe(1);
    expect(() => getApp()).toThrow(); // [DEFAULT] does not exist yet

    const app = defaultApp();
    expect(app.name).toBe('[DEFAULT]');
    expect(getApps().length).toBe(2);
    expect(getApp().name).toBe('[DEFAULT]');
  });

  it('firestore() initializes successfully even when non-default app exists before defaultApp is called', () => {
    initializeApp({ projectId: 'ugc-mock-test-staging' }, '__FIREBASE_FUNCTIONS_SDK__');
    expect(getApps().length).toBe(1);

    const db = firestore();
    expect(db).toBeDefined();
    expect(typeof db.collection).toBe('function');
    expect(db.collection('test').path).toBe('test');
    expect(getApp().name).toBe('[DEFAULT]');
  });

  it('deps() provides a working store connected to default app Firestore', () => {
    initializeApp({ projectId: 'ugc-mock-test-staging' }, '__FIREBASE_FUNCTIONS_SDK__');
    const d = deps();
    expect(d.store).toBeDefined();
    expect(typeof d.clock).toBe('function');
  });
});
