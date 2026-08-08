import styles from "./App.module.css";
import { useMemo, useState } from "react";
import { FavouritesPanel } from "src/components/FavouritesPanel";
import { SentenceBar } from "src/components/SentenceBar";
import { type Tab, ViewMenu } from "src/components/ViewMenu";
import { WordWheel } from "src/components/WordWheel";
import { useFavourites } from "src/favourites/useFavourites";
import { Predictor } from "src/prediction/Predictor";
import { speakPhrase, speakWord } from "src/speech/speech";

// how many words the wheel fits before it reports its real capacity
const DEFAULT_PAGE_SIZE = 22;
// enough for many pages of the "more" button
const SUGGESTION_POOL = 264;

// tokens worth learning: letters and apostrophes, no stray punctuation
const WORD_PATTERN = /^[\p{L}']+$/u;

export function App() {
    const [tab, setTab] = useState<Tab>("speak");
    const [text, setText] = useState("");
    const [page, setPage] = useState(0);
    // how many words fit on the wheel; reported by the wheel from the space
    // it actually gets, so small screens show fewer, larger words
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    // bumped whenever the predictor's suggestions change without the text
    // changing (learning on speak, trashing, reordering)
    const [revision, setRevision] = useState(0);
    const predictor = useMemo(() => new Predictor(), []);
    const { add, favourites, remove } = useFavourites();

    const trimmed = text.trim();
    const tokens = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
    // tapped words always end with a space, so a text that doesn't is a word
    // still being typed: offer completions for it instead of continuations
    const isTypingWord = text.length > 0 && !/\s$/.test(text);
    const context = isTypingWord ? tokens.slice(0, -1) : tokens;
    const prefix = isTypingWord ? tokens[tokens.length - 1] : null;
    // biome-ignore lint/correctness/useExhaustiveDependencies: revision deliberately invalidates the memo when the predictor's internal state changes
    const pool = useMemo(
        () =>
            prefix == null
                ? predictor.suggest(context, SUGGESTION_POOL)
                : predictor.complete(context, prefix, SUGGESTION_POOL),
        [context, predictor, prefix, revision],
    );
    const pageCount = Math.max(1, Math.ceil(pool.length / pageSize));
    const words = pool.slice(page * pageSize, (page + 1) * pageSize);
    const favouriteMatch = favourites.find(
        (favourite) =>
            favourite.text.trim().toLowerCase() === trimmed.toLowerCase(),
    );

    const changeText = (next: string) => {
        setPage(0);
        setText(next);
    };

    // typing into the sentence field; learn each word as it is finished
    const typeText = (next: string) => {
        if (/\s$/.test(next) && !/\s$/.test(text)) {
            const typed = next.trim().split(/\s+/);
            const finished = typed.at(-1);
            if (finished != null && WORD_PATTERN.test(finished)) {
                predictor.learn(typed.slice(0, -1), finished);
            }
        }
        changeText(next);
    };

    // choosing a word completes the word being typed (or continues the
    // sentence) and leaves a trailing space so the next choice continues on.
    // Swipe navigation chooses without speaking.
    const selectWord = (word: string, speak: boolean) => {
        if (speak) {
            speakWord(word);
        }
        predictor.learn(context, word);
        changeText(`${[...context, word].join(" ")} `);
    };

    // the trash button steps back one word
    const deleteLastWord = () => {
        if (tokens.length === 0) {
            return;
        }
        const remaining = tokens.slice(0, -1);
        changeText(remaining.length === 0 ? "" : `${remaining.join(" ")} `);
    };

    const speakSentence = () => {
        // hitting play mid-word means the word is finished; learn it too
        if (prefix != null && WORD_PATTERN.test(prefix)) {
            predictor.learn(context, prefix);
            setRevision(revision + 1);
        }
        speakPhrase(trimmed);
    };

    const trashWord = (word: string) => {
        predictor.block(context, word);
        setRevision(revision + 1);
    };

    const reorderWord = (word: string, slot: number) => {
        // reordering completions of a half-typed word would pin them as
        // ordinary suggestions, which is not what the user meant
        if (prefix != null) {
            return;
        }
        predictor.pin(context, word, page * pageSize + slot);
        setRevision(revision + 1);
    };

    const pushBackWord = (word: string) => {
        if (prefix != null) {
            return;
        }
        const index = pool.indexOf(word);
        predictor.pin(
            context,
            word,
            (index === -1 ? page * pageSize : index) + pageSize,
        );
        setRevision(revision + 1);
    };

    const changeCapacity = (capacity: number) => {
        if (capacity !== pageSize) {
            setPageSize(capacity);
            setPage(0);
        }
    };

    const toggleFavourite = () => {
        if (favouriteMatch == null) {
            add(trimmed);
        } else {
            remove(favouriteMatch.id);
        }
    };

    return (
        <div className={styles.app}>
            <main className={styles.main}>
                {tab === "speak" ? (
                    <div className={styles.speak}>
                        <SentenceBar
                            isFavourite={favouriteMatch != null}
                            onChangeText={typeText}
                            onClear={() => changeText("")}
                            onSpeak={speakSentence}
                            onToggleFavourite={toggleFavourite}
                            text={text}
                        />
                        <div className={styles.wheelArea}>
                            <WordWheel
                                onCapacityChange={changeCapacity}
                                onDeleteLast={deleteLastWord}
                                onMore={
                                    pageCount > 1
                                        ? () => setPage((page + 1) % pageCount)
                                        : null
                                }
                                onNavigate={(word) => selectWord(word, false)}
                                onPushBack={pushBackWord}
                                onReorder={reorderWord}
                                onRepeat={speakWord}
                                onSelect={(word) => selectWord(word, true)}
                                onTrash={trashWord}
                                previousWord={context.at(-1) ?? null}
                                words={words}
                            />
                        </div>
                    </div>
                ) : (
                    <FavouritesPanel
                        favourites={favourites}
                        onRemove={remove}
                    />
                )}
                <ViewMenu onChange={setTab} tab={tab} />
            </main>
        </div>
    );
}
