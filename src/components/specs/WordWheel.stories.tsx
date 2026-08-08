import type { Meta, StoryObj } from "@storybook/react-vite";
import { WordWheel } from "src/components/WordWheel";
import { fn } from "storybook/test";

const meta = {
    args: {
        onCapacityChange: fn(),
        onDeleteLast: fn(),
        onNavigate: fn(),
        onPushBack: fn(),
        onReorder: fn(),
        onRepeat: fn(),
        onSelect: fn(),
        onTrash: fn(),
        previousWord: null,
    },
    component: WordWheel,
    decorators: [
        (Story) => (
            <div style={{ height: "100vh", position: "relative" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof WordWheel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        onMore: fn(),
        words: [
            "I",
            "I'm",
            "Can",
            "Please",
            "Yes",
            "No",
            "Thank",
            "My",
            "It",
            "What",
            "Where",
            "How",
            "Do",
            "Are",
            "The",
            "We",
            "Sorry",
            "Help",
            "Water",
            "Not",
            "That",
            "Good",
        ],
    },
};

export const FewWords: Story = {
    args: {
        onMore: null,
        words: ["you", "please", "water", "help", "now"],
    },
};

export const WithPreviousWord: Story = {
    args: {
        onMore: fn(),
        previousWord: "water",
        words: ["please", "would", "and", "with", "for", "is", "now", "too"],
    },
};
