package main

import (
	"context"
	"fmt"
	"reflect"
	"runtime"
	"sync"
)

type studyError struct{}

func (*studyError) Error() string { return "study error" }

func check(ok bool, message string) {
	if !ok {
		panic(message)
	}
}

func comparisonPanics(a, b any) (panicked bool) {
	defer func() { panicked = recover() != nil }()
	_ = a == b
	return false
}

func deferOrder() (events []int) {
	n := 1
	defer func() { events = append(events, n) }()
	defer func(value int) { events = append(events, value) }(n)
	n = 2
	return
}

func main() {
	a := []int{10, 20, 30}
	b := a[:1]
	b = append(b, 99)
	check(reflect.DeepEqual(a, []int{10, 99, 30}), "append must reuse available capacity")
	a = []int{10, 20, 30}
	b = a[:1:1]
	b[0] = 11
	check(a[0] == 11, "full slice still shares existing elements")
	b = append(b, 99)
	check(a[1] == 20, "full slice append must not overwrite original tail")
	independent := make([]int, len(a))
	copy(independent, a)
	independent[0] = 77
	check(a[0] == 11, "copy into new array must isolate integer elements")

	var pointer *studyError
	var err error = pointer
	check(err != nil, "typed nil must retain its dynamic type")
	typed, ok := err.(*studyError)
	check(ok && typed == nil, "assertion success does not prove nonnil value")
	check(err.Error() == "study error", "nil-safe receiver must be callable")
	var slice any = []int(nil)
	check(slice != nil, "nil slice inside interface is nonnil interface")
	check(comparisonPanics(slice, slice), "same noncomparable dynamic type must panic")
	check(reflect.DeepEqual(deferOrder(), []int{1, 2}), "defer arguments and closure values differ")

	ctx, cancel := context.WithCancel(context.Background())
	out := make(chan int)
	var producers sync.WaitGroup
	producers.Add(3)
	for i := 0; i < 3; i++ {
		go func(value int) {
			defer producers.Done()
			select {
			case out <- value:
			case <-ctx.Done():
			}
		}(i)
	}
	closed := make(chan struct{})
	go func() {
		producers.Wait()
		close(out)
		close(closed)
	}()
	cancel()
	<-closed
	_, ok = <-out
	check(!ok, "coordinator closes only after all producers exit")

	values := make(map[int]int)
	var mu sync.Mutex
	var writers sync.WaitGroup
	writers.Add(4)
	for i := 0; i < 4; i++ {
		go func() {
			defer writers.Done()
			for j := 0; j < 100; j++ {
				mu.Lock()
				values[0]++
				mu.Unlock()
			}
		}()
	}
	writers.Wait()
	check(values[0] == 400, "compound map update must preserve all increments")
	fmt.Println(runtime.Version(), "PASS: slice, interface, defer, producer cancellation, locked map")
}
