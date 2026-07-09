import { useEffect, RefObject } from 'react';

export function useFocusOnMount(ref: RefObject<HTMLElement>) {
    useEffect(() => { ref.current?.focus(); }, []);
}
