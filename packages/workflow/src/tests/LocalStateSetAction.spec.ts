import { LocalStateSetAction } from '..'

describe('LocalStateSetAction', () => {
  test('merges static object', async () => {
    const act = new LocalStateSetAction()
    const ctx: any = {
      action: { key: 'k', typeURI: act.typeUri, staticInput: { merge: { a: { b: 2 } } } },
      instance: { context: { a: { c: 3 } } },
    }
    const res = await act.execute(ctx)
    expect(res.contextMerge).toEqual({ a: { b: 2, c: 3 } })
  })

  test('returns {} when merge is unresolved string or non-object', async () => {
    const act = new LocalStateSetAction()
    // unresolved string path → {}
    const ctx1: any = {
      action: { staticInput: { merge: '{{ input.form.x }}' }, typeURI: act.typeUri },
      instance: { context: {} },
      input: { form: { x: 1 } },
    }
    const res1 = await act.execute(ctx1)
    expect(res1).toEqual({})
    // merge provided but not object → {}
    const ctx2: any = { action: { staticInput: { merge: 42 }, typeURI: act.typeUri }, instance: { context: {} } }
    const res2 = await act.execute(ctx2)
    expect(res2).toEqual({})
  })
})
