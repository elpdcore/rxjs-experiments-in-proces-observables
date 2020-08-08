import { of, pipe, Subject, BehaviorSubject, combineLatest } from "rxjs";
import { switchMap, mergeMap, filter, tap, map } from "rxjs/operators";

class ipSubject extends Subject {
  constructor(...args) {
    super(...args);
    this.inProcess$ = new BehaviorSubject(false);
  }

  next(value) {
    this.inProcess$.next(true);
    super.next(value);
    this.inProcess$.next(false);
  }

  error(e) {
    this.inProcess$.next(true);
    super.next(e);
    this.inProcess$.next(false);
  }

  complete() {
    this.inProcess$.next(true);
    super.complete();
    this.inProcess$.next(false);
  }
}

function ipMergeMap(project) {
  const inProcesSelf$ = new BehaviorSubject(false);
  const inProcessSelfSources$ = new Subject();

  return (source$) => {
    const resultOperatorObs$ = mergeMap((...args) => {
      inProcesSelf$.next(true);
      const result$ = project(...args);
      inProcesSelf$.next(false);
      inProcessSelfSources$.next(result$);
      return result$;
    })(source$);

    const inProcess$ = combineLatest(
      inProcesSelf$,
      source$.inProcess$ || new BehaviorSubject(false),
      inProcessSelfSources$.pipe(
        mergeMap((src$) => {
          return src$.inProcess$ || new BehaviorSubject(false);
        })
      )
    ).pipe(map((list) => list.some((inProcess) => !!inProcess)));

    resultOperatorObs$.inProcess$ = inProcess$;

    return resultOperatorObs$;
  };
}

function ipFilter(predicate) {
  const inProcesSelf$ = new BehaviorSubject(false);

  return (source$) => {
    const resultOperatorObs$ = filter((...args) => {
      inProcesSelf$.next(true);
      const result = predicate(...args);
      inProcesSelf$.next(false);

      return result;
    })(source$);

    const inProcess$ = combineLatest(
      inProcesSelf$,
      source$.inProcess$ || new BehaviorSubject(false)
    ).pipe(map((list) => list.some((inProcess) => !!inProcess)));

    resultOperatorObs$.inProcess$ = inProcess$;

    return resultOperatorObs$;
  };
}

function inPromise(executor) {
  const inProcessSelf$ = new BehaviorSubject(false);

  const promise = new Promise((resolve, reject) => {
    inProcessSelf$.next(true);
    executor(resolve, reject);
  }).then(
    (result) => {
      inProcessSelf$.next(false);
      return result;
    },
    (e) => {
      inProcessSelf$.next(false);
      throw e;
    }
  );

  promise.inProcess$ = inProcessSelf$;

  return promise;
}

const fetchOp$ = new ipSubject();

const test$ = pipe(
  () => fetchOp$,
  ipMergeMap((id) => {
    //switchMap((id) => {
    return inPromise((resolve, reject) => {
      setTimeout(() => {
        resolve(id);
      }, 5000);
    });
  }),
  ipFilter((result) => {
    if (result) {
      return true;
    }

    return false;
  })
)(null);

//console.log('**', test$);
test$.subscribe({
  next: (value) => console.log(`Next Value : ${value}`),
  error: (error) => console.log(error),
  complete: () => console.log("Observable Completed")
});

test$.inProcess$.subscribe({
  next: (value) => console.log(`inProcess => Next Value : ${value}`),
  error: (error) => console.log("inProcess => erro", error),
  complete: () => console.log("inProcess => Observable Completed")
});

fetchOp$.next(1);
fetchOp$.next(null);
fetchOp$.next(2);
//fetchOp$.next(3);
