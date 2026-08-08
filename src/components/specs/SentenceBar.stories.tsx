import type { Meta, StoryObj } from "@storybook/react-vite";
import { SentenceBar } from "src/components/SentenceBar";
import { fn } from "storybook/test";

const meta = {
    args: {
        isFavourite: false,
        onChangeText: fn(),
        onClear: fn(),
        onSpeak: fn(),
        onToggleFavourite: fn(),
    },
    component: SentenceBar,
} satisfies Meta<typeof SentenceBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
    args: {
        text: "",
    },
};

export const WithSentence: Story = {
    args: {
        text: "I need some water",
    },
};

export const FavouriteSentence: Story = {
    args: {
        isFavourite: true,
        text: "Can I have some water?",
    },
};
