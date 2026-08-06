import { useCallback, useRef, useState } from 'react';
import { Translate, TranslateParentType } from './translate';

interface Options {
    text: string;
    docId: string;
    parentType: TranslateParentType;
    /** The `translations` map already on a doc the caller fetched live, if any. */
    existingTranslations?: Record<string, string>;
}

/**
 * Drives a "Translate" / "See original" toggle for one dua or story card.
 * Only usable where the caller is itself a real per-item component instance
 * (DuaCard, TestimonyCard) — NOT inside a .map() over a list, which would
 * violate the Rules of Hooks. CommentThread renders replies inline in a
 * map, so it manages the same state as per-id dictionaries instead; see its
 * handleToggleTranslate.
 */
export function useTranslatable({ text, docId, parentType, existingTranslations }: Options) {
    const [translated, setTranslated] = useState<string | null>(null);
    const [showingTranslation, setShowingTranslation] = useState(false);
    const [loading, setLoading] = useState(false);
    const inFlightRef = useRef(false);

    const toggle = useCallback(async () => {
        if (showingTranslation) { setShowingTranslation(false); return; }
        if (translated) { setShowingTranslation(true); return; }
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setLoading(true);
        const res = await Translate.translate(text, docId, parentType, existingTranslations);
        inFlightRef.current = false;
        setLoading(false);
        if (res.ok) {
            setTranslated(res.text);
            setShowingTranslation(true);
        }
        return res;
    }, [showingTranslation, translated, text, docId, parentType, existingTranslations]);

    return {
        displayText: showingTranslation && translated ? translated : text,
        showingTranslation,
        loading,
        toggle,
    };
}
