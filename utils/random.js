function createRandom() {
    const random = Math.random;

    return {
        float() {
            return random();
        },
        int(min, max) {
            return Math.floor(random() * (max - min + 1)) + min;
        },
        pick(items) {
            if (!items.length)
                throw new Error('Cannot pick from an empty array.');

            return items[Math.floor(random() * items.length)];
        },
        chance(probability) {
            return random() < probability;
        },
        shuffle(items) {
            const copy = [...items];

            for (let index = copy.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(random() * (index + 1));
                [copy[index], copy[swapIndex]] = [
                    copy[swapIndex],
                    copy[index],
                ];
            }

            return copy;
        },
    };
}

export { createRandom };
